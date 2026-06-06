/**
 * End-to-end demo: read a log file (or stdin) and print the IncidentCapsule.
 *
 *   bun run scripts/demo.ts fixtures/api.log
 *   cat some.log | bun run scripts/demo.ts
 */
import { compress } from "../src/index.ts";

const file = process.argv[2];
const text = file ? await Bun.file(file).text() : await Bun.stdin.text();

const started = performance.now();
const capsule = compress(text, { service: "api" });
const ms = (performance.now() - started).toFixed(1);

console.log(JSON.stringify(capsule, null, 2));
console.error(
  `\n${capsule.stats.lines_in.toLocaleString()} lines · ` +
    `${capsule.stats.tokens_in_est.toLocaleString()} tok in -> ` +
    `${capsule.stats.tokens_out_est.toLocaleString()} tok out · ` +
    `${capsule.compression}x · ${ms}ms`,
);
