#!/usr/bin/env bun
/**
 * Logpod CLI.
 *
 *   logpod compress <file|->        read logs, print an IncidentCapsule
 *   logpod wrap [opts] -- <cmd...>  run a command, capture its logs, print capsule
 *   logpod templates <file|->       inspect the template breakdown (routine noise)
 *   logpod stats <file|->           just the numbers: lines, tokens, compression
 *   logpod validate <file|->        check a capsule against the v1 schema
 *
 * Output is compact JSON by default (pipe-friendly); --pretty indents it.
 * JSON always goes to stdout (or --output); diagnostics go to stderr.
 *
 * Exit codes: 0 ok · 1 input/parse problem · 2 CLI usage · 3 schema invalid.
 */
import { compressStream, type StreamOptions } from "./stream.ts";
import { countRareLines, templateReport } from "./report.ts";
import { validateCapsule } from "./validate.ts";
import { LineIndex } from "./lineindex.ts";
import { expandFile } from "./expand.ts";
import type { ReadLimits } from "./linereader.ts";
import type { CompressOptions, LogLevel } from "./types.ts";

const VERSION = "0.0.1";

const EXIT = { OK: 0, INPUT: 1, USAGE: 2, SCHEMA: 3 } as const;

interface Args {
  command: string;
  positionals: string[];
  /** Tokens after `--` (the wrapped command). */
  rest: string[];
  opts: CompressOptions & {
    pretty: boolean;
    limit?: number;
    output?: string;
    levels?: Set<LogLevel>;
    maxLines?: number;
    maxBytes?: number;
    index?: string;
    line?: number;
    context?: number;
  };
}

const HELP = `logpod — systems log compression for AI agents (v${VERSION})

Usage:
  logpod compress <file|->         Compress logs into an IncidentCapsule
  logpod wrap [opts] -- <cmd...>   Run a command, compress its stdout+stderr
  logpod expand <file>             Show the raw lines around a cited line
  logpod templates <file|->        Show the template breakdown
  logpod stats <file|->            Show compression stats (with timing)
  logpod validate <file|->         Validate a capsule against the v1 schema

Options:
  -s, --service <name>    Service name in the capsule        (default: unknown)
  -n, --max-evidence <n>  Max evidence lines                 (default: 12)
      --sim <0..1>        Drain similarity threshold         (default: 0.4)
      --depth <n>         Drain tree depth                   (default: 4)
      --level <list>      Keep only these levels, e.g. ERROR,WARN
      --max-lines <n>     Process at most the first N lines
      --max-bytes <n>     Process at most the first N bytes
      --no-redact         Do not redact PII before templating
      --index <file>      (compress) also write a line-offset index sidecar
      --line <n>          (expand) the cited line to expand
      --context <n>       (expand) lines of context each side (default: 20)
      --limit <n>         (templates) show top N rows        (default: 20)
  -o, --output <file>     Write output to a file instead of stdout
      --pretty            Indent JSON output
  -h, --help              Show this help
  -V, --version           Show version

Examples:
  logpod compress fixtures/api.log -o capsule.json --index capsule.idx
  cat app.log | logpod compress - --level ERROR,WARN
  logpod wrap -- kubectl logs -n prod api
  logpod expand fixtures/api.log --line 30006 --index capsule.idx
  logpod stats fixtures/api.log --max-lines 100000
  logpod validate capsule.json
`;

const VALID_LEVELS = new Set<LogLevel>(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);

function parseLevels(list: string): Set<LogLevel> {
  const out = new Set<LogLevel>();
  for (const part of list.split(",")) {
    const lvl = part.trim().toUpperCase() as LogLevel;
    if (!VALID_LEVELS.has(lvl)) die(`unknown level: ${part.trim()}`);
    out.add(lvl);
  }
  return out;
}

function parseArgs(argv: string[]): Args {
  const opts: Args["opts"] = { pretty: false };
  const positionals: string[] = [];
  let rest: string[] = [];
  let command = "";

  const needValue = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined) die(`flag ${flag} needs a value`);
    return v;
  };
  const num = (raw: string, flag: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n)) die(`flag ${flag} needs a number, got ${raw}`);
    return n;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      rest = argv.slice(i + 1);
      break;
    }
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(HELP);
        process.exit(EXIT.OK);
      case "-V":
      case "--version":
        process.stdout.write(VERSION + "\n");
        process.exit(EXIT.OK);
      case "-s":
      case "--service":
        opts.service = needValue(i++, a);
        break;
      case "-n":
      case "--max-evidence":
        opts.maxEvidence = num(needValue(i++, a), a);
        break;
      case "--sim":
        opts.simThreshold = num(needValue(i++, a), a);
        break;
      case "--depth":
        opts.depth = num(needValue(i++, a), a);
        break;
      case "--limit":
        opts.limit = num(needValue(i++, a), a);
        break;
      case "--level":
        opts.levels = parseLevels(needValue(i++, a));
        break;
      case "--max-lines":
        opts.maxLines = num(needValue(i++, a), a);
        break;
      case "--max-bytes":
        opts.maxBytes = num(needValue(i++, a), a);
        break;
      case "--index":
        opts.index = needValue(i++, a);
        break;
      case "--line":
        opts.line = num(needValue(i++, a), a);
        break;
      case "--context":
        opts.context = num(needValue(i++, a), a);
        break;
      case "-o":
      case "--output":
        opts.output = needValue(i++, a);
        break;
      case "--no-redact":
        opts.redact = false;
        break;
      case "--pretty":
        opts.pretty = true;
        break;
      default:
        // `-` is the stdin marker, not a flag.
        if (a !== "-" && a.startsWith("-")) die(`unknown flag: ${a}`);
        else if (!command) command = a;
        else positionals.push(a);
    }
  }
  return { command, positionals, rest, opts };
}

function die(msg: string, code: number = EXIT.USAGE): never {
  process.stderr.write(`logpod: ${msg}\n`);
  process.exit(code);
}

function serialize(value: unknown, pretty: boolean): string {
  return JSON.stringify(value, null, pretty ? 2 : undefined) + "\n";
}

/** JSON always to stdout, or to --output when set. Returns bytes written. */
async function emit(value: unknown, opts: Args["opts"]): Promise<number> {
  const str = serialize(value, opts.pretty);
  const bytes = Buffer.byteLength(str, "utf8");
  if (opts.output) await Bun.write(opts.output, str);
  else process.stdout.write(str);
  return bytes;
}

/** Build the streaming options/limits from parsed CLI flags. */
function streamOptions(opts: Args["opts"], fallbackService?: string): StreamOptions {
  return {
    service: opts.service ?? fallbackService,
    maxEvidence: opts.maxEvidence,
    simThreshold: opts.simThreshold,
    depth: opts.depth,
    redact: opts.redact,
    levels: opts.levels,
  };
}

function readLimits(opts: Args["opts"]): ReadLimits {
  return { maxBytes: opts.maxBytes, maxLines: opts.maxLines };
}

/**
 * Open a positional source as a byte stream (never loading it whole).
 * Returns the stream plus the input size in bytes when known (files).
 */
async function openStream(
  positionals: string[],
): Promise<{ stream: ReadableStream<Uint8Array>; bytes?: number }> {
  const src = positionals[0];
  if (!src || src === "-") return { stream: Bun.stdin.stream() };
  const file = Bun.file(src);
  if (!(await file.exists())) die(`no such file: ${src}`, EXIT.INPUT);
  return { stream: file.stream(), bytes: file.size };
}

/** Read a whole positional source as text (for small inputs like a capsule). */
async function readText(positionals: string[]): Promise<string> {
  const src = positionals[0];
  if (!src || src === "-") return await Bun.stdin.text();
  const file = Bun.file(src);
  if (!(await file.exists())) die(`no such file: ${src}`, EXIT.INPUT);
  return await file.text();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command) {
    process.stdout.write(HELP);
    process.exit(EXIT.OK);
  }

  switch (args.command) {
    case "compress": {
      const { stream } = await openStream(args.positionals);
      const index = args.opts.index ? new LineIndex() : undefined;
      const acc = await compressStream(stream, readLimits(args.opts), streamOptions(args.opts), index);
      await emit(acc.capsule(), args.opts);
      if (index && args.opts.index) await Bun.write(args.opts.index, index.serialize());
      break;
    }

    case "expand": {
      const src = args.positionals[0];
      if (!src || src === "-") die("expand needs a seekable file (not stdin)");
      if (args.opts.line === undefined) die("expand needs --line <n>");
      let index: LineIndex | undefined;
      if (args.opts.index) {
        const idxFile = Bun.file(args.opts.index);
        if (!(await idxFile.exists())) die(`no such index: ${args.opts.index}`, EXIT.INPUT);
        index = LineIndex.parse(await idxFile.text());
      }
      try {
        const result = await expandFile(src, args.opts.line, args.opts.context ?? 20, index);
        await emit(result, args.opts);
      } catch (e) {
        die((e as Error).message, EXIT.INPUT);
      }
      break;
    }

    case "wrap": {
      if (args.rest.length === 0) die("wrap needs a command after `--`");
      const proc = Bun.spawn(args.rest, { stdout: "pipe", stderr: "pipe" });
      // Logs may land on either stream; compress both, then forward exit code.
      const [out, err, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      const text = out + (err && !out.endsWith("\n") ? "\n" : "") + err;
      const stream = new Response(text).body!;
      const acc = await compressStream(stream, readLimits(args.opts), streamOptions(args.opts, args.rest[0]));
      await emit(acc.capsule(), args.opts);
      process.exit(code);
    }

    case "templates": {
      const { stream } = await openStream(args.positionals);
      const acc = await compressStream(stream, readLimits(args.opts), streamOptions(args.opts));
      const templates = acc.templates();
      const rows = templateReport(templates, acc.lines).slice(0, args.opts.limit ?? 20);
      await emit({ template_count: templates.length, lines_in: acc.lines, templates: rows }, args.opts);
      break;
    }

    case "stats": {
      const started = performance.now();
      const { stream } = await openStream(args.positionals);
      const acc = await compressStream(stream, readLimits(args.opts), streamOptions(args.opts));
      const capsule = acc.capsule();
      const elapsedMs = Math.round((performance.now() - started) * 10) / 10;
      const output = {
        lines_in: acc.lines,
        tokens_in_est: capsule.stats.tokens_in_est,
        tokens_out_est: capsule.stats.tokens_out_est,
        compression: capsule.compression,
        template_count: capsule.routine_summary.template_count,
        rare_lines: countRareLines(acc.templates(), acc.lines),
        performance: {
          elapsed_ms: elapsedMs,
          lines_per_sec: elapsedMs > 0 ? Math.round((acc.lines / elapsedMs) * 1000) : 0,
          input_bytes: acc.bytes,
        },
      };
      await emit(output, args.opts);
      break;
    }

    case "validate": {
      const text = await readText(args.positionals);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        await emit({ valid: false, errors: [`not valid JSON: ${(e as Error).message}`] }, args.opts);
        process.exit(EXIT.SCHEMA);
      }
      const result = validateCapsule(parsed);
      await emit(result, args.opts);
      process.exit(result.valid ? EXIT.OK : EXIT.SCHEMA);
    }

    default:
      die(`unknown command: ${args.command} (try --help)`);
  }
}

await main();
