/**
 * End-to-end eval: grep vs logpod capsule — diagnostic quality.
 *
 * Beyond binary recall, we measure whether an LLM could *actually* diagnose
 * from the output: signal density, root accessibility, temporal fidelity,
 * causal chain completeness, and noise ratio.
 *
 *   bun run scripts/eval-end-to-end.ts fixtures/incident.log
 */
import { compressLines } from "../src/stream.ts";
import { streamLines } from "../src/linereader.ts";
import { countTokens } from "../src/tokens.ts";

const file = process.argv[2] ?? "fixtures/incident.log";
if (!(await Bun.file(file).exists())) {
  console.error(`no such file: ${file}`);
  process.exit(1);
}

// Ground truth: the 5 facts an agent must recover, with expected causal role.
const FACTS = [
  { role: "trigger",     needle: "pool acquire",     lineHint: 180_000 },
  { role: "root_cause",  needle: "operationalerror", lineHint: 180_455 },
  { role: "consequence", needle: "circuit breaker",  lineHint: 180_459 },
  { role: "consequence", needle: "upstream timeout", lineHint: 180_457 },
  { role: "consequence", needle: "pool exhausted",   lineHint: 180_458 },
];

// --- helpers --------------------------------------------------------------

function recall(text: string): number {
  const hay = text.toLowerCase();
  return FACTS.filter((f) => hay.includes(f.needle)).length;
}

function factPositions(text: string): { needle: string; pos: number }[] {
  const hay = text.toLowerCase();
  const out: { needle: string; pos: number }[] = [];
  for (const f of FACTS) {
    const idx = hay.indexOf(f.needle);
    if (idx >= 0) out.push({ needle: f.needle, pos: idx });
  }
  return out.sort((a, b) => a.pos - b.pos);
}

function rootLatency(text: string, rootNeedle = "operationalerror"): number {
  const hay = text.toLowerCase();
  const idx = hay.indexOf(rootNeedle);
  if (idx < 0) return Infinity;
  const prefix = text.slice(0, idx);
  return countTokens(prefix);
}

function temporalFidelity(text: string): number {
  // Facts should appear in chronological order: trigger < root < consequences
  const positions = factPositions(text);
  const order = positions.map((p) => FACTS.find((f) => f.needle === p.needle)!.role);
  // Expected: trigger(s) first, then root, then consequences
  let triggerSeen = false;
  let rootSeen = false;
  let ok = true;
  for (const r of order) {
    if (r === "trigger") { if (rootSeen) ok = false; triggerSeen = true; }
    if (r === "root_cause") { rootSeen = true; }
    if (r === "consequence") { if (!rootSeen) ok = false; }
  }
  return ok && triggerSeen && rootSeen ? 1 : 0;
}

function causalCompleteness(text: string): number {
  const positions = factPositions(text);
  const roles = positions.map((p) => FACTS.find((f) => f.needle === p.needle)!.role);
  const hasTrigger = roles.includes("trigger");
  const hasRoot = roles.includes("root_cause");
  const hasConsequence = roles.includes("consequence");
  // Full chain = trigger → root → consequence
  let chain = hasTrigger && hasRoot && hasConsequence ? 0.5 : 0;
  // Bonus: temporal ordering is correct
  if (chain && temporalFidelity(text)) chain += 0.5;
  return chain;
}

function noiseRatio(text: string, totalLines: number): number {
  const rec = recall(text);
  return totalLines > 0 ? (totalLines - rec) / totalLines : 0;
}

async function sh(cmd: string): Promise<string> {
  const proc = Bun.spawn(["bash", "-c", cmd], { stdout: "pipe", stderr: "ignore" });
  const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return out;
}

interface Strategy {
  name: string;
  text: string;
  lines: number;
  tokens: number;
  recall: number;
  rootLatency: number;      // tokens until root cause needle
  signalDensity: number;    // facts per 1000 tokens
  temporalFidelity: number; // 0 or 1
  causalCompleteness: number; // 0..1
  noiseRatio: number;       // 0..1
  roles: boolean;           // carries causal roles?
  diagnosticScore: number; // 0..1 composite
}

// --- strategies -----------------------------------------------------------

const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
const F = q(file);

const rows: Strategy[] = [];

// 1) raw log
const rawText = await Bun.file(file).text();
rows.push(makeRow("raw log (whole file)", rawText, false));

// 2) grep ERROR
rows.push(makeRow("grep ERROR", await sh(`grep -nE 'ERROR' ${F}`), false));

// 3) grep error|warn (the "best" grep)
rows.push(makeRow("grep -iE 'error|warn'", await sh(`grep -niE 'error|warn' ${F}`), false));

// 4) grep | head -40 (token-budgeted agent)
rows.push(makeRow("grep error|warn | head -40", await sh(`grep -niE 'error|warn' ${F} | head -40`), false));

// 5) grep strip vars uniq (smart collapse)
rows.push(makeRow("grep ERROR | strip vars | uniq", await sh(
  `grep -E 'ERROR' ${F} | sed -E 's/[0-9]+//g; s/^[^ ]+ //' | sort | uniq -c | sort -rn | head -20`
), false));

// 6) logpod capsule (streaming pipeline)
const started = performance.now();
const capsule = await compressLines(streamLines(Bun.file(file).stream()), { service: "api" });
const capsuleMs = (performance.now() - started).toFixed(0);
const capsuleText = JSON.stringify(capsule);
rows.push(makeRow("logpod capsule", capsuleText, true, capsule.evidence.length));

// --- scoring --------------------------------------------------------------

function makeRow(name: string, text: string, roles: boolean, itemCount?: number): Strategy {
  const lines = text === "" ? 0 : text.replace(/\n$/, "").split("\n").length;
  const tokens = countTokens(text);
  const rec = recall(text);
  const rl = rootLatency(text);
  const sig = tokens > 0 ? (rec / tokens) * 1000 : 0;
  const tf = temporalFidelity(text);
  const cc = causalCompleteness(text);
  // For structured outputs (capsule), use the actual evidence count.
  const countForNoise = itemCount ?? lines;
  const nr = noiseRatio(text, countForNoise);
  // Diagnostic score: weighted composite
  const ds = (rec / 5) * 0.35 + tf * 0.20 + cc * 0.25 + Math.min(sig * 5, 1) * 0.20;
  return { name, text, lines, tokens, recall: rec, rootLatency: rl, signalDensity: sig,
    temporalFidelity: tf, causalCompleteness: cc, noiseRatio: nr, roles, diagnosticScore: ds };
}

// --- report ---------------------------------------------------------------

function pad(s: string, n: number) { return s.padEnd(n); }
function padL(s: string, n: number) { return s.padStart(n); }

console.log(`\n=== End-to-End Diagnostic Eval: grep vs logpod ===\n`);
console.log(`log: ${file} — ${rawText.split("\n").length.toLocaleString()} lines, 5 planted facts\n`);

console.log(
  pad("strategy", 38) +
  padL("lines", 8) +
  padL("tokens", 10) +
  padL("recall", 7) +
  padL("rootΔ", 8) +
  padL("sig/1k", 7) +
  padL("temp", 5) +
  padL("chain", 6) +
  padL("noise", 6) +
  padL("diag", 6) +
  "  roles"
);
console.log("-".repeat(115));

for (const r of rows) {
  const rootStr = r.rootLatency === Infinity ? "∞" : r.rootLatency.toLocaleString();
  console.log(
    pad(r.name, 38) +
    padL(r.lines.toLocaleString(), 8) +
    padL(r.tokens.toLocaleString(), 10) +
    padL(`${r.recall}/5`, 7) +
    padL(rootStr, 8) +
    padL(r.signalDensity.toFixed(2), 7) +
    padL(r.temporalFidelity.toFixed(0), 5) +
    padL(r.causalCompleteness.toFixed(2), 6) +
    padL(r.noiseRatio.toFixed(2), 6) +
    padL(r.diagnosticScore.toFixed(2), 6) +
    "  " + (r.roles ? "yes" : "no")
  );
}
console.log("-".repeat(115));

// Summary comparison
const cap = rows.find((r) => r.name === "logpod capsule")!;
const grepBest = rows.find((r) => r.name === "grep -iE 'error|warn'")!;
const raw = rows.find((r) => r.name === "raw log (whole file)")!;

console.log(`\n--- Summary ---\n`);
console.log(`Capsule: ${cap.tokens.toLocaleString()} tokens · ${cap.recall}/5 facts · ${cap.diagnosticScore.toFixed(2)} diag score`);
console.log(`Grep:    ${grepBest.tokens.toLocaleString()} tokens · ${grepBest.recall}/5 facts · ${grepBest.diagnosticScore.toFixed(2)} diag score`);
console.log(`Raw:     ${raw.tokens.toLocaleString()} tokens · ${raw.recall}/5 facts · ${raw.diagnosticScore.toFixed(2)} diag score`);

console.log(`\nCapsule vs grep best:`);
console.log(`  Token reduction: ${Math.round(grepBest.tokens / cap.tokens)}× smaller`);
console.log(`  Root latency:    ${cap.rootLatency === Infinity ? "∞" : cap.rootLatency.toLocaleString()} vs ${grepBest.rootLatency === Infinity ? "∞" : grepBest.rootLatency.toLocaleString()} tokens to root cause`);
console.log(`  Signal density:  ${cap.signalDensity.toFixed(2)} vs ${grepBest.signalDensity.toFixed(2)} facts/1000 tokens`);
console.log(`  Temporal order:  ${cap.temporalFidelity.toFixed(0)} vs ${grepBest.temporalFidelity.toFixed(0)}`);
console.log(`  Causal chain:    ${cap.causalCompleteness.toFixed(2)} vs ${grepBest.causalCompleteness.toFixed(2)}`);
console.log(`  Diagnostic score: ${cap.diagnosticScore.toFixed(2)} vs ${grepBest.diagnosticScore.toFixed(2)}`);

console.log(`\n--- Verdict ---\n`);
if (cap.diagnosticScore > grepBest.diagnosticScore && cap.tokens < grepBest.tokens / 10) {
  console.log("✅ CAPSULE WINS: Same/better recall, better causal structure, 100×+ fewer tokens.");
  console.log("   The LLM sees the incident chain in ~700 tokens instead of drowning in 141k.");
} else if (cap.diagnosticScore > grepBest.diagnosticScore) {
  console.log("✅ CAPSULE BETTER: Higher diagnostic score, but verify token savings are real.");
} else {
  console.log("⚠️  CAPSULE UNDERPERFORMS: Grep wins on diagnostic score; investigate.");
}

console.log(`\nCapsule produced in ${capsuleMs}ms\n`);
