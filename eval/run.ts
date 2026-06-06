#!/usr/bin/env bun
/**
 * logpod evaluation harness.
 *
 * Streams every scenario's log through the real compression pipeline and scores
 * the resulting capsule on hard, deterministic metrics (recall, role accuracy,
 * citation integrity, context loss, parse health, schema validity). Writes
 * per-scenario results and an aggregate REPORT.md. See eval/README.md.
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { compressLines } from "../src/stream.ts";
import { streamLines } from "../src/linereader.ts";
import { validateCapsule } from "../src/validate.ts";
import { parseLine, redactLine, stripAnsi } from "../src/preprocess.ts";
import type { IncidentCapsule } from "../src/types.ts";

const HERE = dirname(new URL(import.meta.url).pathname);
const SCEN_DIR = join(HERE, "scenarios");
const RES_DIR = join(HERE, "results");

interface GroundTruth {
  needle: string;
  role?: string;
  desc?: string;
}
interface Meta {
  id: string;
  provider: string;
  format: string;
  envelope?: string;
  incident: string;
  ground_truth: GroundTruth[];
  expect?: { ts?: boolean; level?: boolean; min_recall?: number };
}

interface Metrics {
  id: string;
  provider: string;
  format: string;
  envelope: string;
  lines_in: number;
  tokens_in: number;
  tokens_out: number;
  compression: number;
  template_count: number;
  pct_ts: number;
  pct_level: number;
  evidence_count: number;
  roles: string[];
  has_root_cause: boolean;
  recall: number; // 0..1
  facts_found: number;
  facts_total: number;
  role_accuracy: number | null; // over facts that specify a role and are present
  citation_integrity: number; // 0..1 over evidence
  context_loss: string[]; // ground-truth needles missing from the capsule
  schema_valid: boolean;
  schema_errors: string[];
  error: string | null;
  // expectations
  expect_ts: boolean;
  expect_level: boolean;
  min_recall: number;
  pass: boolean;
}

/** Physical lines, dropping the trailing empty element a final newline produces. */
function physicalLines(text: string): string[] {
  const all = text.split("\n");
  if (text.endsWith("\n")) all.pop();
  return all;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function evaluate(meta: Meta, text: string, capsule: IncidentCapsule): Metrics {
  const lines = physicalLines(text);
  const capsuleStr = JSON.stringify(capsule).toLowerCase();

  // parse health (recompute per physical, non-blank line — mirrors the engine)
  let withTs = 0;
  let withLevel = 0;
  let nonBlank = 0;
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    nonBlank++;
    const p = parseLine(raw, 1);
    if (p.ts !== null) withTs++;
    if (p.level !== null) withLevel++;
  }

  // recall + context loss
  const found: GroundTruth[] = [];
  const missing: string[] = [];
  for (const g of meta.ground_truth) {
    if (capsuleStr.includes(g.needle.toLowerCase())) found.push(g);
    else missing.push(g.needle);
  }
  const recall = meta.ground_truth.length ? found.length / meta.ground_truth.length : 1;

  // role accuracy over present facts that declare an expected role
  const roleFacts = found.filter((g) => g.role);
  let roleCorrect = 0;
  for (const g of roleFacts) {
    const ev = capsule.evidence.find((e) => e.text.toLowerCase().includes(g.needle.toLowerCase()));
    if (ev && ev.role === g.role) roleCorrect++;
  }
  const roleAccuracy = roleFacts.length ? roleCorrect / roleFacts.length : null;

  // citation integrity: cited source line must reconstruct to evidence.text
  let citeOk = 0;
  for (const e of capsule.evidence) {
    const src = lines[e.line - 1];
    if (src !== undefined && redactLine(stripAnsi(src)) === e.text) citeOk++;
  }
  const citationIntegrity = capsule.evidence.length ? citeOk / capsule.evidence.length : 1;

  const valid = validateCapsule(capsule);
  const roles = [...new Set(capsule.evidence.map((e) => e.role))];
  const expectTs = meta.expect?.ts ?? false;
  const expectLevel = meta.expect?.level ?? false;
  const minRecall = meta.expect?.min_recall ?? 0;

  const pass =
    valid.valid &&
    recall >= minRecall &&
    citationIntegrity === 1 &&
    (!expectTs || withTs / Math.max(1, nonBlank) > 0.5) &&
    (!expectLevel || withLevel / Math.max(1, nonBlank) > 0.5);

  return {
    id: meta.id,
    provider: meta.provider,
    format: meta.format,
    envelope: meta.envelope ?? "none",
    lines_in: capsule.stats.lines_in,
    tokens_in: capsule.stats.tokens_in_est,
    tokens_out: capsule.stats.tokens_out_est,
    compression: capsule.compression,
    template_count: capsule.routine_summary.template_count,
    pct_ts: pct(withTs, nonBlank),
    pct_level: pct(withLevel, nonBlank),
    evidence_count: capsule.evidence.length,
    roles,
    has_root_cause: roles.includes("root_cause"),
    recall: Math.round(recall * 100) / 100,
    facts_found: found.length,
    facts_total: meta.ground_truth.length,
    role_accuracy: roleAccuracy === null ? null : Math.round(roleAccuracy * 100) / 100,
    citation_integrity: Math.round(citationIntegrity * 100) / 100,
    context_loss: missing,
    schema_valid: valid.valid,
    schema_errors: valid.errors,
    error: null,
    expect_ts: expectTs,
    expect_level: expectLevel,
    min_recall: minRecall,
    pass,
  };
}

async function runScenario(id: string): Promise<Metrics> {
  const dir = join(SCEN_DIR, id);
  const meta = JSON.parse(await Bun.file(join(dir, "meta.json")).text()) as Meta;
  const text = await Bun.file(join(dir, "log.txt")).text();
  try {
    const capsule = await compressLines(streamLines(new Response(text).body!), { service: meta.id });
    const m = evaluate(meta, text, capsule);
    // persist capsule + a log sample for the judge
    const sample = physicalLines(text);
    writeFileSync(
      join(RES_DIR, `${id}.json`),
      JSON.stringify({ meta, metrics: m, capsule, log_lines: sample.length }, null, 2),
    );
    return m;
  } catch (e) {
    const err = (e as Error).stack ?? String(e);
    return {
      id, provider: meta.provider, format: meta.format, envelope: meta.envelope ?? "none",
      lines_in: 0, tokens_in: 0, tokens_out: 0, compression: 0, template_count: 0,
      pct_ts: 0, pct_level: 0, evidence_count: 0, roles: [], has_root_cause: false,
      recall: 0, facts_found: 0, facts_total: meta.ground_truth.length, role_accuracy: null,
      citation_integrity: 0, context_loss: meta.ground_truth.map((g) => g.needle),
      schema_valid: false, schema_errors: [], error: err,
      expect_ts: meta.expect?.ts ?? false, expect_level: meta.expect?.level ?? false,
      min_recall: meta.expect?.min_recall ?? 0, pass: false,
    };
  }
}

function bar(v: number): string {
  const n = Math.round(v * 10);
  return "█".repeat(n) + "░".repeat(10 - n);
}

function writeReport(rows: Metrics[]): void {
  const n = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const avg = (f: (r: Metrics) => number) => (n ? rows.reduce((s, r) => s + f(r), 0) / n : 0);
  const errored = rows.filter((r) => r.error);
  const lossy = rows.filter((r) => r.context_loss.length > 0 && !r.error);
  const badCite = rows.filter((r) => r.citation_integrity < 1 && !r.error);

  let md = `# logpod eval report\n\n`;
  md += `_Generated ${new Date().toISOString()} · ${n} scenarios · **${passed}/${n} pass**_\n\n`;
  md += `## Aggregate\n\n`;
  md += `| metric | mean |\n|---|---|\n`;
  md += `| recall | ${avg((r) => r.recall).toFixed(2)} |\n`;
  md += `| role accuracy | ${avg((r) => r.role_accuracy ?? 0).toFixed(2)} |\n`;
  md += `| citation integrity | ${avg((r) => r.citation_integrity).toFixed(2)} |\n`;
  md += `| % lines w/ timestamp | ${avg((r) => r.pct_ts).toFixed(1)}% |\n`;
  md += `| % lines w/ level | ${avg((r) => r.pct_level).toFixed(1)}% |\n`;
  md += `| schema valid | ${rows.filter((r) => r.schema_valid).length}/${n} |\n\n`;

  md += `## Per scenario\n\n`;
  md += `| ✓ | id | provider | fmt | envelope | lines | ratio | recall | role | cite | ts% | lvl% |\n`;
  md += `|---|---|---|---|---|--:|--:|:--:|:--:|:--:|--:|--:|\n`;
  for (const r of rows.slice().sort((a, b) => Number(a.pass) - Number(b.pass))) {
    const rec = `${r.facts_found}/${r.facts_total}`;
    const role = r.role_accuracy === null ? "—" : r.role_accuracy.toFixed(2);
    md += `| ${r.pass ? "✅" : "❌"} | ${r.id} | ${r.provider} | ${r.format} | ${r.envelope} | ${r.lines_in} | ${r.compression}× | ${rec} | ${role} | ${r.citation_integrity.toFixed(2)} | ${r.pct_ts} | ${r.pct_level} |\n`;
  }

  if (errored.length) {
    md += `\n## ⚠ Errors (${errored.length})\n\n`;
    for (const r of errored) md += `### ${r.id}\n\`\`\`\n${r.error}\n\`\`\`\n`;
  }
  if (lossy.length) {
    md += `\n## ⚠ Context loss (${lossy.length})\n\nGround-truth facts missing from the capsule:\n\n`;
    for (const r of lossy) md += `- **${r.id}** (${r.provider}): missing \`${r.context_loss.join("`, `")}\`\n`;
  }
  if (badCite.length) {
    md += `\n## ⚠ Citation integrity < 1.0 (${badCite.length})\n\n`;
    for (const r of badCite) md += `- **${r.id}**: ${r.citation_integrity.toFixed(2)} — a cited line does not reconstruct to its evidence text\n`;
  }

  md += `\n## Parse-health outliers (the ingestion gaps)\n\n`;
  for (const r of rows.filter((x) => (x.expect_ts && x.pct_ts < 50) || (x.expect_level && x.pct_level < 50))) {
    md += `- **${r.id}** (${r.provider}/${r.envelope}): ts ${r.pct_ts}% (expect ${r.expect_ts}), level ${r.pct_level}% (expect ${r.expect_level})\n`;
  }

  writeFileSync(join(RES_DIR, "..", "REPORT.md"), md);
  writeFileSync(join(RES_DIR, "summary.json"), JSON.stringify(rows, null, 2));
}

async function main() {
  if (!existsSync(RES_DIR)) mkdirSync(RES_DIR, { recursive: true });
  const want = process.argv.slice(2);
  const ids = readdirSync(SCEN_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        existsSync(join(SCEN_DIR, d.name, "meta.json")) &&
        existsSync(join(SCEN_DIR, d.name, "log.txt")),
    )
    .map((d) => d.name)
    .filter((id) => want.length === 0 || want.includes(id))
    .sort();

  if (ids.length === 0) {
    console.error("no scenarios found under eval/scenarios/");
    process.exit(1);
  }

  const rows: Metrics[] = [];
  for (const id of ids) {
    const m = await runScenario(id);
    rows.push(m);
    const tag = m.error ? "ERR " : m.pass ? "PASS" : "FAIL";
    console.log(
      `${tag}  ${id.padEnd(34)} recall ${m.facts_found}/${m.facts_total}  ${bar(m.recall)}  ` +
        `cite ${m.citation_integrity.toFixed(2)}  ratio ${m.compression}x  ts ${m.pct_ts}%  lvl ${m.pct_level}%`,
    );
  }
  writeReport(rows);
  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${passed}/${rows.length} pass · report → eval/REPORT.md · results → eval/results/`);
}

await main();
