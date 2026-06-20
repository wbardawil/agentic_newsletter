import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { StrategicAngle } from "../types/edition.js";

const HISTORY_FILE = "angle-history.json";
const MAX_HISTORY = 8;

export type FailurePattern =
  | "temporal-tense-mismatch"
  | "unverified-motivation"
  | "overgeneralization"
  | "none";

interface HistoryEntry {
  editionId: string;
  recordedAt: string;
  angle: StrategicAngle;
  /** First ~200 chars of the English Field Report body, for entity de-duplication. */
  fieldReportSummary?: string;
  /** Hard failure reasons from QualityGate — present only when the draft failed. */
  qgFailureReasons?: string[];
  /** Classified failure pattern for Strategist guidance. */
  failurePattern?: FailurePattern;
  /** Source outlets implicated in the failure — guides Strategist to handle them carefully. */
  failureSourceOutlets?: string[];
}

interface HistoryFile {
  entries: HistoryEntry[];
}

export interface FailurePatternRecord {
  editionId: string;
  pattern: FailurePattern;
  sourceOutlets: string[];
  failureReasons: string[];
}

export function loadAngleHistory(draftsDir: string): StrategicAngle[] {
  const path = join(draftsDir, HISTORY_FILE);
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as HistoryFile;
    return raw.entries.map((e) => e.angle);
  } catch {
    return [];
  }
}

/** Return the last N Field Report summaries for entity de-duplication. */
export function loadRecentFieldReportSummaries(draftsDir: string): string[] {
  const path = join(draftsDir, HISTORY_FILE);
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as HistoryFile;
    return raw.entries
      .filter((e) => e.fieldReportSummary)
      .map((e) => `[${e.editionId}] ${e.fieldReportSummary!}`);
  } catch {
    return [];
  }
}

/** Append the angle for this edition; drop entries older than MAX_HISTORY. */
export function recordAngle(
  draftsDir: string,
  editionId: string,
  angle: StrategicAngle,
  fieldReportSummary?: string,
): void {
  mkdirSync(draftsDir, { recursive: true });
  const path = join(draftsDir, HISTORY_FILE);
  let file: HistoryFile = { entries: [] };
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, "utf-8")) as HistoryFile;
    } catch {
      file = { entries: [] };
    }
  }
  // Remove any prior entry for the same edition (idempotent re-runs)
  file.entries = file.entries.filter((e) => e.editionId !== editionId);
  const entry: HistoryEntry = {
    editionId,
    recordedAt: new Date().toISOString(),
    angle,
  };
  if (fieldReportSummary) entry.fieldReportSummary = fieldReportSummary;
  file.entries.push(entry);
  // Keep only the most recent MAX_HISTORY
  file.entries = file.entries.slice(-MAX_HISTORY);
  writeFileSync(path, JSON.stringify(file, null, 2), "utf-8");
}

/**
 * Annotate an existing history entry with QualityGate failure information.
 * Call this when a run exits with a QualityGate hard failure, so the next
 * Strategist run can avoid the same patterns.
 */
export function recordAngleFailure(
  draftsDir: string,
  editionId: string,
  hardFailures: string[],
  impliedOutlets: string[],
): void {
  const path = join(draftsDir, HISTORY_FILE);
  if (!existsSync(path)) return;

  let file: HistoryFile;
  try {
    file = JSON.parse(readFileSync(path, "utf-8")) as HistoryFile;
  } catch {
    return;
  }

  const entry = file.entries.find((e) => e.editionId === editionId);
  if (!entry) return;

  entry.qgFailureReasons = hardFailures;
  entry.failureSourceOutlets = impliedOutlets;

  // Classify the dominant failure pattern
  const allReasons = hardFailures.join(" ").toLowerCase();
  if (allReasons.includes("temporal") || allReasons.includes("future") || allReasons.includes("tense")) {
    entry.failurePattern = "temporal-tense-mismatch";
  } else if (allReasons.includes("motivation") || allReasons.includes("intent") || allReasons.includes("why")) {
    entry.failurePattern = "unverified-motivation";
  } else if (allReasons.includes("sector") || allReasons.includes("generaliz") || allReasons.includes("pattern")) {
    entry.failurePattern = "overgeneralization";
  } else {
    entry.failurePattern = "none";
  }

  writeFileSync(path, JSON.stringify(file, null, 2), "utf-8");
}

/**
 * Return recent QualityGate failure patterns for Strategist guidance.
 * Only includes entries that actually failed (have qgFailureReasons).
 */
export function loadRecentFailurePatterns(draftsDir: string): FailurePatternRecord[] {
  const path = join(draftsDir, HISTORY_FILE);
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as HistoryFile;
    return raw.entries
      .filter((e) => e.qgFailureReasons && e.failurePattern && e.failurePattern !== "none")
      .slice(-4) // last 4 failures at most
      .map((e) => ({
        editionId: e.editionId,
        pattern: e.failurePattern!,
        sourceOutlets: e.failureSourceOutlets ?? [],
        failureReasons: e.qgFailureReasons!,
      }));
  } catch {
    return [];
  }
}
