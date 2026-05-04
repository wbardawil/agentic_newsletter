/**
 * Verify candidate RSS feeds before adding them to Radar's RSS_FEEDS array.
 *
 * Usage:
 *   pnpm verify:feeds                       — verify all candidates in config/feed-candidates.json
 *   pnpm verify:feeds --apply               — print TS code block for surviving feeds, ready to paste into radar.ts
 *   pnpm verify:feeds --timeout 20000       — override per-feed timeout (default 12000ms)
 *
 * Why: a previous PR pruned 45 dead feeds. Don't reintroduce dead feeds —
 * verify each candidate fetches and parses as RSS/Atom before it ships.
 *
 * Reads:  config/feed-candidates.json
 * Writes: nothing (prints a status table; with --apply, prints a paste-ready TS block)
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

interface Candidate {
  outlet: string;
  url: string;
  region: "us" | "mx" | "corridor";
  tier: 1 | 2 | 3;
  category: string;
}

interface CandidateFile {
  candidates: Candidate[];
}

interface VerificationResult {
  candidate: Candidate;
  status: "ok" | "fail";
  itemCount?: number | undefined;
  firstTitle?: string | undefined;
  error?: string | undefined;
  elapsedMs: number;
}

async function verifyOne(
  parser: Parser,
  candidate: Candidate,
): Promise<VerificationResult> {
  const start = Date.now();
  try {
    const parsed = await parser.parseURL(candidate.url);
    const items = parsed.items ?? [];
    return {
      candidate,
      status: "ok",
      itemCount: items.length,
      firstTitle: items[0]?.title?.slice(0, 80),
      elapsedMs: Date.now() - start,
    };
  } catch (err) {
    return {
      candidate,
      status: "fail",
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - start,
    };
  }
}

function emitTsBlock(results: VerificationResult[]): string {
  const ok = results.filter((r) => r.status === "ok");
  return ok
    .map((r) => {
      const c = r.candidate;
      return `  {
    outlet: "${c.outlet.replace(/"/g, '\\"')}",
    url: "${c.url}",
    region: "${c.region}",
    tier: ${c.tier},
  },`;
    })
    .join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const timeoutIdx = args.indexOf("--timeout");
  const timeout =
    timeoutIdx >= 0 ? Number.parseInt(args[timeoutIdx + 1] ?? "", 10) : 12000;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidatesPath = join(here, "..", "..", "config", "feed-candidates.json");
  const file = JSON.parse(readFileSync(candidatesPath, "utf-8")) as CandidateFile;

  const parser = new Parser({
    timeout,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (transformation-letter feed-verifier) RSS-Parser",
    },
  });

  console.log(
    `Verifying ${file.candidates.length} candidate feeds (timeout ${timeout}ms)...\n`,
  );

  const results = await Promise.all(
    file.candidates.map((c) => verifyOne(parser, c)),
  );

  const ok = results.filter((r) => r.status === "ok");
  const fail = results.filter((r) => r.status === "fail");

  for (const r of results) {
    const icon = r.status === "ok" ? "✓" : "✗";
    const stat =
      r.status === "ok"
        ? `${r.itemCount} items`
        : `(${r.error?.slice(0, 60) ?? "error"})`;
    console.log(
      `${icon} [${r.candidate.tier}/${r.candidate.region}/${r.candidate.category}] ${r.candidate.outlet} — ${stat} (${r.elapsedMs}ms)`,
    );
  }

  console.log(
    `\nResult: ${ok.length}/${results.length} feeds live, ${fail.length} failed.`,
  );

  if (apply) {
    console.log("\n// ── Paste-ready FeedConfig block for radar.ts ──");
    console.log(emitTsBlock(results));
  } else if (ok.length > 0) {
    console.log("\nRun with --apply to print a paste-ready TS block.");
  }

  process.exit(fail.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("verify-feeds failed:", err);
  process.exit(2);
});
