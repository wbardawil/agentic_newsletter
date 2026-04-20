import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { StrategicAngle } from "../types/edition.js";

const HISTORY_FILE = "angle-history.json";
const MAX_HISTORY = 8;

interface HistoryEntry {
  editionId: string;
  recordedAt: string;
  angle: StrategicAngle;
}

interface HistoryFile {
  entries: HistoryEntry[];
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

/** Append the angle for this edition; drop entries older than MAX_HISTORY. */
export function recordAngle(
  draftsDir: string,
  editionId: string,
  angle: StrategicAngle,
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
  file.entries.push({
    editionId,
    recordedAt: new Date().toISOString(),
    angle,
  });
  // Keep only the most recent MAX_HISTORY
  file.entries = file.entries.slice(-MAX_HISTORY);
  writeFileSync(path, JSON.stringify(file, null, 2), "utf-8");
}
