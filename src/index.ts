/**
 * Logcite — systems log compression for AI agents.
 *
 * Turns line-oriented logs into a cited, schema-valid IncidentCapsule:
 *
 *   import { compress } from "logcite";              // in-memory, small inputs
 *   const capsule = compress(rawLogText, { service: "api" });
 *
 *   import { compressLines } from "logcite";         // streaming, bounded memory
 *   const capsule = await compressLines(lineSource, { service: "api" });
 *
 * Every piece of evidence cites a real line number and is tagged by its causal
 * role. Nothing is summarized away, nothing is invented.
 */
export { compress } from "./compress.ts";
export { compressStream, compressLines, StreamAccumulator } from "./stream.ts";
export type { StreamOptions } from "./stream.ts";
export { streamLines } from "./linereader.ts";
export type { RawLine, ReadLimits } from "./linereader.ts";
export { LineIndex, DEFAULT_STRIDE } from "./lineindex.ts";
export type { Checkpoint } from "./lineindex.ts";
export { expandFile, expandText } from "./expand.ts";
export type { ExpandResult, ContextLine } from "./expand.ts";
export { scanStream } from "./scan.ts";
export type { ScanResult, ScanFinding, ScanGroup, ScanOptions, CompiledPattern } from "./scan.ts";
export { redactLine, redactSecrets, detectSecrets } from "./redact.ts";
export type { SecretFinding } from "./redact.ts";
export { countTokens, TOKENIZER } from "./tokens.ts";
export { validateCapsule } from "./validate.ts";
export type { ValidationResult } from "./validate.ts";
export type {
  CompressOptions,
  Evidence,
  EvidenceRole,
  IncidentCapsule,
  LogLevel,
  ParsedLine,
  RecurringFailure,
  RoutineSummary,
  Template,
} from "./types.ts";
