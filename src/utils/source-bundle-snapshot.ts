import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SourceBundleSchema,
  type SourceBundle,
} from "../types/source-bundle.js";

/**
 * Snapshot the SourceBundle after Radar succeeds so downstream agent failures
 * can be replayed without rescanning RSS. Without this, `pnpm draft --edition
 * 2026-XX` twice in a row pulls two different corridor news windows: the first
 * Radar run produces one bundle, the second produces a different one, and any
 * Strategist angle built on the first is invalidated.
 *
 * The snapshot lives at `drafts/{editionId}-sources.json`. It is JSON because
 * the SourceBundle schema is JSON-safe and this keeps the file human-readable
 * for debugging.
 *
 * Conventions:
 * - `loadSnapshot` returns null on any error (missing file, malformed JSON,
 *   schema mismatch). The caller falls back to a live Radar scan.
 * - `saveSnapshot` overwrites any existing file for the edition. Running the
 *   same edition twice produces the second day's news window, which is the
 *   desired behavior when the caller deliberately deletes the snapshot.
 */

const SNAPSHOT_SUFFIX = "-sources.json";

function snapshotPath(draftsDir: string, editionId: string): string {
  return join(draftsDir, `${editionId}${SNAPSHOT_SUFFIX}`);
}

export function loadSnapshot(
  draftsDir: string,
  editionId: string,
): SourceBundle | null {
  const path = snapshotPath(draftsDir, editionId);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return SourceBundleSchema.parse(raw);
  } catch {
    return null;
  }
}

export function saveSnapshot(
  draftsDir: string,
  editionId: string,
  bundle: SourceBundle,
): void {
  const path = snapshotPath(draftsDir, editionId);
  writeFileSync(path, JSON.stringify(bundle, null, 2), "utf-8");
}

/** Exposed for tests and CLI use. */
export function getSnapshotPath(draftsDir: string, editionId: string): string {
  return snapshotPath(draftsDir, editionId);
}
