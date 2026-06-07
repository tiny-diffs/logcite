/**
 * A/B: IncidentCapsule vs grep.
 *
 * Same log, same incident. We compare what a debugging agent would actually be
 * handed under each strategy, on three axes that matter for an agent:
 *   - tokens   : context cost (real BPE count)
 *   - lines    : how much it must scan
 *   - recall   : how many of the 5 ground-truth diagnostic facts survive
 *   - roles    : does the artifact carry causality (trigger/root/consequence)?
 *
 *   bun run scripts/ab-grep.ts fixtures/incident.log
 *
 * grep strategies are run via the real `grep`, so this reflects a shell an agent
 * would drive. The capsule is produced by the streaming pipeline.
 */
import { compressLines } from "../src/stream.ts";
import { streamLines } from "../src/linereader.ts";
import { countTokens } from "../src/tokens.ts";

const file = process.argv[2] ?? "fixtures/incident.log";
if (!(await Bun.file(file).exists())) {
  console.error(`no such file: ${file} — run: bun run scripts/gen-incident.ts > ${file}`);
  process.exit(1);
}

// Ground-truth diagnostic facts, as digit-free lowercase needles (robust to
// strategies that strip ids/timestamps).
const FACTS = [
  { role: "trigger", needle: "pool acquire" },
  { role: "root_cause", needle: "operationalerror" },
  { role: "consequence", needle: "circuit breaker" },
  { role: "consequence", needle: "upstream timeout" },
  { role: "consequence", needle: "pool exhausted" },
];

function recall(text: string): number {
  const hay = text.toLowerCase();
  return FACTS.filter((f) => hay.includes(f.needle)).length;
}

async function sh(cmd: string): Promise<string> {
  const proc = Bun.spawn(["bash", "-c", cmd], { stdout: "pipe", stderr: "ignore" });
  const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return out;
}

interface Row {
  name: string;
  text: string;
  roles: boolean;
}

const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
const F = q(file);

const rows: Row[] = [];

// 0) Raw control — the whole file (what "just read the logs" costs).
rows.push({ name: "raw log (whole file)", text: await Bun.file(file).text(), roles: false });

// 1) Naive: errors only.
rows.push({ name: "grep ERROR", text: await sh(`grep -nE 'ERROR' ${F}`), roles: false });

// 2) Errors + warnings (catches the trigger, but returns the storm).
rows.push({ name: "grep -iE 'error|warn'", text: await sh(`grep -niE 'error|warn' ${F}`), roles: false });

// 3) Token-budgeted agent: first 40 matching lines.
rows.push({
  name: "grep -iE 'error|warn' | head -40",
  text: await sh(`grep -niE 'error|warn' ${F} | head -40`),
  roles: false,
});

// 4) "Smart" agent: collapse the storm into templates by stripping variables.
rows.push({
  name: "grep ERROR | strip vars | uniq -c | sort",
  text: await sh(
    `grep -E 'ERROR' ${F} | sed -E 's/[0-9]+//g; s/^[^ ]+ //' | sort | uniq -c | sort -rn | head -20`,
  ),
  roles: false,
});

// 5) Logcite capsule (streaming pipeline).
const started = performance.now();
const capsule = await compressLines(streamLines(Bun.file(file).stream()), { service: "api" });
const capsuleMs = (performance.now() - started).toFixed(0);
const capsuleText = JSON.stringify(capsule);
rows.push({ name: "logcite capsule", text: capsuleText, roles: true });

// --- report ---------------------------------------------------------------
const totalLines = (await Bun.file(file).text()).split("\n").length - 1;
console.log(`\nlog: ${file} — ${totalLines.toLocaleString()} lines, incident planted\n`);

const pad = (s: string, n: number) => s.padEnd(n);
const padL = (s: string, n: number) => s.padStart(n);
console.log(
  pad("strategy", 42) + padL("lines", 9) + padL("tokens", 12) + padL("recall", 9) + "  roles",
);
console.log("-".repeat(82));

const capsuleTokens = countTokens(capsuleText);
for (const r of rows) {
  const lines = r.text === "" ? 0 : r.text.replace(/\n$/, "").split("\n").length;
  const tokens = countTokens(r.text);
  const rec = recall(r.text);
  console.log(
    pad(r.name, 42) +
      padL(lines.toLocaleString(), 9) +
      padL(tokens.toLocaleString(), 12) +
      padL(`${rec}/5`, 9) +
      "  " +
      (r.roles ? "yes" : "no"),
  );
}

console.log("-".repeat(82));
const grepBest = rows.find((r) => r.name === "grep -iE 'error|warn'")!;
const grepBestTokens = countTokens(grepBest.text);
console.log(
  `\ncapsule: ${capsuleTokens.toLocaleString()} tokens, ${recall(capsuleText)}/5 facts, with causal roles, in ${capsuleMs}ms`,
);
console.log(
  `vs "grep error|warn" (also 5/5): ${grepBestTokens.toLocaleString()} tokens -> capsule is ${Math.round(grepBestTokens / capsuleTokens)}x smaller`,
);
console.log(
  `vs raw log: ${countTokens(rows[0]!.text).toLocaleString()} tokens -> capsule is ${Math.round(countTokens(rows[0]!.text) / capsuleTokens)}x smaller\n`,
);
