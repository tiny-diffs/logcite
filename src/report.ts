/**
 * Lightweight reports over the templates, used by the `templates` and `stats`
 * CLI commands. Kept separate from capsule assembly so inspection output never
 * changes the capsule contract.
 */
import type { Template } from "./types.ts";

export interface TemplateRow {
  id: string;
  count: number;
  /** Share of total lines, 0..1. */
  share: number;
  level: string;
  pattern: string;
}

export function templateReport(
  templates: Template[],
  totalLines: number,
): TemplateRow[] {
  const total = totalLines || 1;
  return templates.map((t) => ({
    id: t.id,
    count: t.count,
    share: Math.round((t.count / total) * 1000) / 1000,
    level: t.level ?? "-",
    pattern: t.pattern,
  }));
}

/** Lines whose template covers <1% of total volume — the "rare" tail. */
export function countRareLines(templates: Template[], totalLines: number): number {
  const rareThreshold = Math.max(1, totalLines * 0.01);
  return templates
    .filter((t) => t.count < rareThreshold)
    .reduce((n, t) => n + t.count, 0);
}
