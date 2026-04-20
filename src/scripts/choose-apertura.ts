/**
 * Record Wadi's Apertura choice for an edition.
 *
 * Usage:
 *   pnpm choose 2026-16           — reads EN draft, records edited apertura
 *   pnpm choose 2026-16 A         — records EN Option A
 *   pnpm choose 2026-16 A es      — records ES Option A from the ES draft
 *   pnpm choose 2026-16 own es    — reads edited ES draft apertura
 *   pnpm choose 2026-16 es        — same as "own es": reads edited ES draft
 *
 * After recording, the next `pnpm draft` will inject approved examples into
 * the Writer (EN) or Localizer (ES) prompt and reduce the number of options
 * generated as the style converges.
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

const OPTION_DELIMITER = /===OPTION_([ABC]):(\w+)===/g;

function parseDraftAperturaOptions(
  editionId: string,
  language: "en" | "es",
): Array<{ label: string; style: string; body: string }> {
  const suffix = language === "es" ? "es" : "en";
  const draftPath = join(DRAFTS_DIR, `${editionId}-${suffix}.md`);
  if (!existsSync(draftPath)) {
    console.error(`Draft not found: ${draftPath}`);
    process.exit(1);
  }
  const content = readFileSync(draftPath, "utf-8");

  // EN uses "## THE APERTURA", ES uses "## LA APERTURA"
  const aperturaMatch = content.match(
    /##\s+(?:THE|LA) APERTURA[^\n]*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n##\s+)/,
  );
  if (!aperturaMatch) {
    return [{ label: "own", style: "own", body: content.slice(0, 500) }];
  }

  const block = aperturaMatch[1] ?? "";
  const options: Array<{ label: string; style: string; body: string }> = [];

  // The rendered markdown uses "### Option A - style" headings (from renderAperturaOptions).
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
  const cleaned = raw.replace(/===OPTION_[ABC]:\w+===/g, "").trim();
  return { style: "own", body: cleaned };
}

async function main() {
  const args = process.argv.slice(2);
  const [editionId, ...rest] = args;

  if (!editionId) {
    console.error("Usage: pnpm choose <edition-id> [A|B|C|own] [en|es]");
    console.error("Example: pnpm choose 2026-16");
    console.error("Example: pnpm choose 2026-16 A");
    console.error("Example: pnpm choose 2026-16 A es");
    console.error("Example: pnpm choose 2026-16 es   (reads edited ES draft)");
    process.exit(1);
  }

  // Parse remaining args: optional label (A/B/C/own), optional language (en/es)
  const LABELS = ["A", "B", "C", "OWN"];
  const LANGS = ["en", "es"];

  let labelArg: string | undefined;
  let language: "en" | "es" = "en";

  for (const arg of rest) {
    if (LANGS.includes(arg.toLowerCase())) {
      language = arg.toLowerCase() as "en" | "es";
    } else if (LABELS.includes(arg.toUpperCase())) {
      labelArg = arg.toUpperCase();
    }
  }

  // "own" is the same as no label
  if (labelArg === "OWN") labelArg = undefined;

  let style: string;
  let body: string;

  if (labelArg && ["A", "B", "C"].includes(labelArg)) {
    const options = parseDraftAperturaOptions(editionId, language);
    const chosen = options.find((o) => o.label === labelArg);
    if (!chosen) {
      const suffix = language === "es" ? "es" : "en";
      console.error(`Option ${labelArg} not found in draft ${editionId}-${suffix}.md`);
      process.exit(1);
    }
    style = chosen.style;
    body = chosen.body;
    console.log(`Recording Option ${labelArg} (${style}) for ${editionId} [${language}].`);
  } else {
    const result = readEditedApertura(editionId, language);
    style = result.style;
    body = result.body;
    console.log(`Recording edited apertura for ${editionId} [${language}].`);
  }

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
