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
import { verifyDiagnosis } from "./diagnose.ts";
import type { ReadLimits } from "./linereader.ts";
import type { CandidatePool, CompressOptions, LogLevel } from "./types.ts";

const VERSION = "0.0.1";

const EXIT = { OK: 0, INPUT: 1, USAGE: 2, SCHEMA: 3 } as const;

interface Args {
  command: string;
  positionals: string[];
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
    stats?: boolean;
    templates?: boolean;
    pool?: string;
  };
}

const HELP = `logpod — systems log compression for AI agents (v${VERSION})

Usage:
  logpod compress <file|->         Compress logs into an IncidentCapsule
  logpod expand <file>             Show the raw lines around a cited line
  logpod pool <file|->             Emit the cited candidate set for a reasoner
  logpod verify <diag.json>        Check a diagnosis cites only real pool ids
  logpod validate <file|->         Validate a capsule against the v1 schema

The pool/verify pair powers the CLI+skill reasoner: \`pool\` hands a host agent
the closed set of cited candidates; the agent writes a diagnosis citing those
ids; \`verify --pool\` enforces it invented nothing. logpod itself never reasons.

Options:
  -s, --service <name>    Service name in the capsule        (default: unknown)
  -n, --max-evidence <n>  Max evidence lines                 (default: 12)
      --sim <0..1>        Drain similarity threshold         (default: 0.4)
      --depth <n>         Drain tree depth                   (default: 4)
      --level <list>      Keep only these levels, e.g. ERROR,WARN
      --max-lines <n>     Process at most the first N lines
      --max-bytes <n>     Process at most the first N bytes
      --no-redact         Do not redact PII before templating
      --stats             (compress) print numbers only, with timing
      --templates         (compress) print the template breakdown
      --limit <n>         (compress --templates) show top N rows (default: 20)
      --index <file>      (compress) also write a line-offset index sidecar
      --line <n>          (expand) the cited line to expand
      --context <n>       (expand) lines of context each side (default: 20)
      --limit <n>         (pool) max candidates to emit          (default: 60)
      --pool <file>       (verify) the candidate pool to check against
  -o, --output <file>     Write output to a file instead of stdout
      --pretty            Indent JSON output
  -h, --help              Show this help
  -V, --version           Show version

Examples:
  logpod compress fixtures/api.log -o capsule.json --index capsule.idx
  cat app.log | logpod compress - --level ERROR,WARN
  kubectl logs -n prod api 2>&1 | logpod compress -
  logpod compress fixtures/api.log --stats --max-lines 100000
  logpod compress fixtures/api.log --templates --limit 10
  logpod expand fixtures/api.log --line 30006 --index capsule.idx
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
      case "--stats":
        opts.stats = true;
        break;
      case "--templates":
        opts.templates = true;
        break;
      case "--pool":
        opts.pool = needValue(i++, a);
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
  return { command, positionals, opts };
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
function streamOptions(opts: Args["opts"]): StreamOptions {
  return {
    service: opts.service,
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
      if (args.opts.stats && args.opts.templates) die("use only one of --stats / --templates");
      const started = performance.now();
      const { stream } = await openStream(args.positionals);
      const index = args.opts.index ? new LineIndex() : undefined;
      const acc = await compressStream(stream, readLimits(args.opts), streamOptions(args.opts), index);

      if (args.opts.templates) {
        // template breakdown view (same input, different lens)
        const templates = acc.templates();
        const rows = templateReport(templates, acc.lines).slice(0, args.opts.limit ?? 20);
        await emit({ template_count: templates.length, lines_in: acc.lines, templates: rows }, args.opts);
      } else if (args.opts.stats) {
        // numbers-only view, with timing
        const capsule = acc.capsule();
        const elapsedMs = Math.round((performance.now() - started) * 10) / 10;
        await emit(
          {
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
          },
          args.opts,
        );
      } else {
        await emit(acc.capsule(), args.opts);
      }

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

    case "pool": {
      // Over-collected, cited candidate set for the CLI+skill reasoner.
      const { stream } = await openStream(args.positionals);
      const acc = await compressStream(stream, readLimits(args.opts), streamOptions(args.opts));
      await emit(acc.pool(args.opts.limit ?? 60), args.opts);
      break;
    }

    case "verify": {
      // Citation firewall: check an agent's diagnosis cites only real pool ids.
      if (!args.opts.pool) die("verify needs --pool <pool.json>");
      const poolFile = Bun.file(args.opts.pool);
      if (!(await poolFile.exists())) die(`no such pool: ${args.opts.pool}`, EXIT.INPUT);
      let pool: CandidatePool;
      let diag: unknown;
      try {
        pool = JSON.parse(await poolFile.text()) as CandidatePool;
      } catch (e) {
        die(`pool is not valid JSON: ${(e as Error).message}`, EXIT.INPUT);
      }
      try {
        diag = JSON.parse(await readText(args.positionals));
      } catch (e) {
        await emit({ valid: false, errors: [`diagnosis is not valid JSON: ${(e as Error).message}`] }, args.opts);
        process.exit(EXIT.SCHEMA);
      }
      const result = verifyDiagnosis(diag, pool!);
      await emit(result, args.opts);
      process.exit(result.valid ? EXIT.OK : EXIT.SCHEMA);
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
