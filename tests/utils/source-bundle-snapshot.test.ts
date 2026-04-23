import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSnapshot,
  saveSnapshot,
  getSnapshotPath,
} from "../../src/utils/source-bundle-snapshot.js";
import type { SourceBundle } from "../../src/types/source-bundle.js";

function makeBundle(): SourceBundle {
  return {
    editionId: "2026-20",
    scannedAt: "2026-04-20T12:00:00.000Z",
    totalScanned: 100,
    totalSelected: 20,
    items: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        sourceType: "rss",
        title: "Test article",
        url: "https://example.com/a",
        publishedAt: "2026-04-20T10:00:00.000Z",
        author: "Reporter",
        outlet: "Expansión",
        summary: "Summary.",
        verbatimFacts: ["fact 1", "fact 2", "fact 3"],
        relevanceScore: 0.9,
        recencyHours: 2,
        tags: ["corridor"],
      },
    ],
    metadata: {
      feedsScanned: 52,
      timeWindowHours: 168,
      filterCriteria: ["corridor relevance"],
    },
  };
}

describe("source-bundle-snapshot", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snapshot-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no snapshot exists", () => {
    expect(loadSnapshot(dir, "2026-20")).toBeNull();
  });

  it("writes and reads a bundle with schema roundtrip", () => {
    const bundle = makeBundle();
    saveSnapshot(dir, "2026-20", bundle);
    const loaded = loadSnapshot(dir, "2026-20");
    expect(loaded).not.toBeNull();
    expect(loaded?.editionId).toBe("2026-20");
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]?.url).toBe("https://example.com/a");
    expect(loaded?.totalSelected).toBe(20);
  });

  it("returns null when the file contains malformed JSON", () => {
    const path = getSnapshotPath(dir, "2026-20");
    writeFileSync(path, "{ not json", "utf-8");
    expect(loadSnapshot(dir, "2026-20")).toBeNull();
  });

  it("returns null when the file is valid JSON but fails schema validation", () => {
    const path = getSnapshotPath(dir, "2026-20");
    writeFileSync(path, JSON.stringify({ editionId: "2026-20", items: [] }), "utf-8");
    expect(loadSnapshot(dir, "2026-20")).toBeNull();
  });

  it("overwrites an existing snapshot on save", () => {
    const first = makeBundle();
    saveSnapshot(dir, "2026-20", first);
    const second: SourceBundle = { ...first, totalSelected: 42 };
    saveSnapshot(dir, "2026-20", second);
    const loaded = loadSnapshot(dir, "2026-20");
    expect(loaded?.totalSelected).toBe(42);
  });

  it("keeps different editions in separate files", () => {
    const b1 = makeBundle();
    const b2: SourceBundle = { ...b1, editionId: "2026-21", totalSelected: 15 };
    saveSnapshot(dir, "2026-20", b1);
    saveSnapshot(dir, "2026-21", b2);
    expect(loadSnapshot(dir, "2026-20")?.totalSelected).toBe(20);
    expect(loadSnapshot(dir, "2026-21")?.totalSelected).toBe(15);
    expect(existsSync(getSnapshotPath(dir, "2026-20"))).toBe(true);
    expect(existsSync(getSnapshotPath(dir, "2026-21"))).toBe(true);
  });
});
