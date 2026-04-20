/**
 * Record Wadi's Apertura choice for an edition.
 *
 * Usage:
 *   pnpm choose 2026-16        — reads the draft file, records whatever
 *                                apertura text remains after editing
 *   pnpm choose 2026-16 A      — records Option A without reading the file
 *   pnpm choose 2026-16 own    — same as no label: reads the edited draft
 *
 * After recording, the next `pnpm draft` will inject approved examples into
 * the Writer prompt and reduce the number of options generated as the style
 * converges.
 */

import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAperturaHistory,
  recordAperturaChoice,
  optionCount,
  type AperturaExample,
} from "../utils/apertura-history.js";

const DRAFTS_DIR = resolve(
  join(fileURLToPath(import.meta.url), "..", "..", "..", "drafts"),
);

const OPTION_DELIMITER = /===OPTION_([ABC]):(\w+)===/g;

function parseDraftAperturaOptions(
  editionId: string,
): Array<{ label: string; style: string; body: string }> {
  const draftPath = join(DRAFTS_DIR, `${editionId}-en.md`);
  if (!existsSync(draftPath)) {
    console.error(`Draft not found: ${draftPath}`);
    process.exit(1);
  }
  const content = readFileSync(draftPath, "utf-8");

  // Extract the Apertura section
  const aperturaMatch = content.match(
    /##\s+THE APERTURA[^\n]*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n##\s+)/,
  );
  if (!aperturaMatch) {
    // No option delimiters — treat the whole apertura block as "own"
    return [{ label: "own", style: "own", body: content.slice(0, 500) }];
  }

  const block = aperturaMatch[1] ?? "";
  const options: Array<{ label: string; style: string; body: string }> = [];

  // The rendered markdown uses "### Option A - style" headings (from renderAperturaOptions).
  // Split on those headings to extract each option's body.
  const parts = block.split(/###\s+Option\s+[ABC]\s+-\s+\w+/);
  const headers = [...block.matchAll(/###\s+Option\s+([ABC])\s+-\s+(\w+)/g)];

  for (let i = 0; i < headers.length; i++) {
    const label = headers[i]![1]!;
    const style = headers[i]![2]!;
    const body = (parts[i + 1] ?? "").trim();
    if (body) options.push({ label, style, body });
  }

  return options;
}

function readEditedApertura(editionId: string): { style: string; body: string } {
  const draftPath = join(DRAFTS_DIR, `${editionId}-en.md`);
  if (!existsSync(draftPath)) {
    console.error(`Draft not found: ${draftPath}`);
    process.exit(1);
  }
  const content = readFileSync(draftPath, "utf-8");
  const aperturaMatch = content.match(
    /##\s+THE APERTURA[^\n]*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n##\s+)/,
  );
  if (!aperturaMatch) {
    console.error("Could not find THE APERTURA section in draft.");
    process.exit(1);
  }
  const raw = (aperturaMatch[1] ?? "").trim();
  // Strip any remaining option delimiters (user may have deleted all but one)
  const cleaned = raw.replace(/===OPTION_[ABC]:\w+===/g, "").trim();
  return { style: "own", body: cleaned };
}

async function main() {
  const [editionId, labelArg] = process.argv.slice(2);

  if (!editionId) {
    console.error("Usage: pnpm choose <edition-id> [A|B|C|own]");
    console.error("Example: pnpm choose 2026-16");
    console.error("Example: pnpm choose 2026-16 A");
    process.exit(1);
  }

  let style: string;
  let body: string;

  if (labelArg && ["A", "B", "C"].includes(labelArg.toUpperCase())) {
    // Explicit label — find that option in the draft
    const options = parseDraftAperturaOptions(editionId);
    const chosen = options.find(
      (o) => o.label === labelArg.toUpperCase(),
    );
    if (!chosen) {
      console.error(`Option ${labelArg} not found in draft ${editionId}-en.md`);
      process.exit(1);
    }
    style = chosen.style;
    body = chosen.body;
    console.log(`Recording Option ${labelArg} (${style}) for ${editionId}.`);
  } else {
    // Read whatever is left in the apertura section after editing
    const result = readEditedApertura(editionId);
    style = result.style;
    body = result.body;
    console.log(`Recording edited apertura for ${editionId}.`);
  }

  const example: AperturaExample = {
    editionId,
    style,
    body,
    chosenAt: new Date().toISOString(),
  };

  recordAperturaChoice(DRAFTS_DIR, example);

  const history = loadAperturaHistory(DRAFTS_DIR);
  const nextCount = optionCount(history);
  const remaining = Math.max(0, 5 - history.length);

  console.log(`✓ Saved. History: ${history.length} example(s).`);
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
