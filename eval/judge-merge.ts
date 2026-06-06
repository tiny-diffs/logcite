#!/usr/bin/env bun
/**
 * Merge unbiased-judge verdicts into the eval report.
 *
 * Each judge agent writes eval/judge/<id>.json with this shape (scores 0..10):
 *   { id, signal, faithfulness, context_loss, actionability, overall,
 *     summary: string, improvements: string[] }
 * where:
 *   signal        — is the incident's root cause + causal chain recoverable?
 *   faithfulness  — are citations real / nothing invented or mislabeled?
 *   context_loss  — how little important info is missing (10 = nothing lost)
 *   actionability — could a debugging agent act from the capsule alone?
 *
 * This script aggregates them and appends a "Judge verdicts" section to
 * eval/REPORT.md, plus eval/results/judge-summary.json.
 */
import { readdirSync, existsSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);
const JUDGE_DIR = join(HERE, "judge");
const REPORT = join(HERE, "REPORT.md");

interface Verdict {
  id: string;
  signal: number;
  faithfulness: number;
  context_loss: number;
  actionability: number;
  overall: number;
  summary: string;
  improvements: string[];
}

const AXES = ["signal", "faithfulness", "context_loss", "actionability", "overall"] as const;

function main() {
  if (!existsSync(JUDGE_DIR)) {
    console.error("no eval/judge/ verdicts yet");
    process.exit(1);
  }
  const verdicts: Verdict[] = readdirSync(JUDGE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(JUDGE_DIR, f), "utf8")) as Verdict)
    .sort((a, b) => a.overall - b.overall);

  if (verdicts.length === 0) {
    console.error("no verdict json files");
    process.exit(1);
  }

  const mean = (k: (typeof AXES)[number]) =>
    verdicts.reduce((s, v) => s + (v[k] ?? 0), 0) / verdicts.length;

  let md = `\n\n## Judge verdicts (unbiased LLM, 0–10)\n\n`;
  md += `_${verdicts.length} capsules judged · overall mean **${mean("overall").toFixed(1)}**_\n\n`;
  md += `| axis | mean |\n|---|---|\n`;
  for (const a of AXES) md += `| ${a} | ${mean(a).toFixed(1)} |\n`;

  md += `\n| overall | id | signal | faith | ctx-loss | action | summary |\n`;
  md += `|--:|---|:--:|:--:|:--:|:--:|---|\n`;
  for (const v of verdicts) {
    md += `| ${v.overall} | ${v.id} | ${v.signal} | ${v.faithfulness} | ${v.context_loss} | ${v.actionability} | ${v.summary.replace(/\|/g, "/")} |\n`;
  }

  // Improvement themes: collect all suggestions from the lowest-scoring half.
  md += `\n### Improvements the judge called out (worst-scoring first)\n\n`;
  for (const v of verdicts.slice(0, Math.ceil(verdicts.length / 2))) {
    if (v.improvements?.length) {
      md += `**${v.id}** (overall ${v.overall}):\n`;
      for (const imp of v.improvements) md += `- ${imp}\n`;
    }
  }

  appendFileSync(REPORT, md);
  writeFileSync(join(HERE, "results", "judge-summary.json"), JSON.stringify(verdicts, null, 2));
  console.log(`merged ${verdicts.length} verdicts · overall mean ${mean("overall").toFixed(1)} → eval/REPORT.md`);
}

main();
