/**
 * Record Wadi's Apertura choice for an edition.
 *
 * Usage:
 *   pnpm choose 2026-16        — reads EN draft, records whatever is in the
 *                                Apertura section as Wadi's chosen body
 *   pnpm choose 2026-16 es     — same, for the ES draft
 *
 * The renderer now writes a single Apertura body (Option B from the Writer's
 * options block, or the ES transcreation), so there are no A/B/C labels to
 * pick from. Edit the draft to taste, then run this script. Each recording
 * pushes the next draft's `aperturaOptionCount` toward 1 — after 5 picks the
 * Writer generates one option in your converged voice.
 */

import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAperturaHistoryByLanguage,
  recordAperturaChoice,
  optionCount,
  type AperturaExample,
} from "../utils/apertura-history.js";

const DRAFTS_DIR = resolve(
  join(fileURLToPath(import.meta.url), "..", "..", "..", "drafts"),
);

function readEditedApertura(
  editionId: string,
  language: "en" | "es",
): { style: string; body: string } {
  const suffix = language === "es" ? "es" : "en";
  const draftPath = join(DRAFTS_DIR, `${editionId}-${suffix}.md`);
  if (!existsSync(draftPath)) {
    console.error(`Draft not found: ${draftPath}`);
    process.exit(1);
  }
  const content = readFileSync(draftPath, "utf-8");
  const aperturaMatch = content.match(
    /##\s+(?:THE|LA) APERTURA[^\n]*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n##\s+)/,
  );
  if (!aperturaMatch) {
    console.error("Could not find THE/LA APERTURA section in draft.");
    process.exit(1);
  }
  const raw = (aperturaMatch[1] ?? "").trim();
  // Strip any leftover Writer option delimiters defensively.
  const cleaned = raw.replace(/===OPTION_[ABC]:\w+===/g, "").trim();
  return { style: "own", body: cleaned };
}

async function main() {
  const args = process.argv.slice(2);
  const [editionId, ...rest] = args;

  if (!editionId) {
    console.error("Usage: pnpm choose <edition-id> [en|es]");
    console.error("Example: pnpm choose 2026-16");
    console.error("Example: pnpm choose 2026-16 es");
    process.exit(1);
  }

  let language: "en" | "es" = "en";
  for (const arg of rest) {
    const lower = arg.toLowerCase();
    if (lower === "en" || lower === "es") {
      language = lower;
    }
  }

  const { style, body } = readEditedApertura(editionId, language);
  console.log(`Recording edited apertura for ${editionId} [${language}].`);

  const example: AperturaExample = {
    editionId,
    style,
    body,
    chosenAt: new Date().toISOString(),
    language,
  };

  recordAperturaChoice(DRAFTS_DIR, example);

  const history = loadAperturaHistoryByLanguage(DRAFTS_DIR, language);
  const nextCount = optionCount(history);
  const remaining = Math.max(0, 5 - history.length);

  console.log(`✓ Saved. ${language.toUpperCase()} history: ${history.length} example(s).`);
  if (remaining > 0) {
    console.log(
      `  Next draft will offer ${nextCount} option(s). ` +
        `${remaining} more choice(s) until style converges to 1.`,
    );
  } else {
    console.log(
      "  Style converged — next draft will write one Apertura in your voice.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
