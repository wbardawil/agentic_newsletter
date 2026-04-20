import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HISTORY_FILE = "apertura-history.json";
const MAX_EXAMPLES = 8;

export interface AperturaExample {
  editionId: string;
  /** "observation" | "provocation" | "pattern" | "own" */
  style: string;
  body: string;
  chosenAt: string;
  /** "en" (default) or "es" */
  language?: "en" | "es";
}

export interface AperturaOption {
  label: "A" | "B" | "C";
  style: string;
  body: string;
}

/** How many Apertura options to generate based on history depth. */
export function optionCount(history: AperturaExample[]): 1 | 2 | 3 {
  if (history.length >= 5) return 1;
  if (history.length >= 3) return 2;
  return 3;
}

export function loadAperturaHistory(draftsDir: string): AperturaExample[] {
  const filePath = join(draftsDir, HISTORY_FILE);
  if (!existsSync(filePath)) return [];
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as AperturaExample[];
  } catch {
    return [];
  }
}

/** Filter history by language. Entries without a language field default to "en". */
export function loadAperturaHistoryByLanguage(
  draftsDir: string,
  language: "en" | "es",
): AperturaExample[] {
  return loadAperturaHistory(draftsDir).filter(
    (e) => (e.language ?? "en") === language,
  );
}

export function recordAperturaChoice(
  draftsDir: string,
  example: AperturaExample,
): void {
  const filePath = join(draftsDir, HISTORY_FILE);
  const history = loadAperturaHistory(draftsDir);
  history.push(example);
  const trimmed = history.slice(-MAX_EXAMPLES);
  writeFileSync(filePath, JSON.stringify(trimmed, null, 2), "utf-8");
}

/** Format history examples for injection into the Writer prompt. */
export function formatAperturaExamplesForPrompt(
  history: AperturaExample[],
): string {
  if (history.length === 0) return "";
  return history
    .map(
      (ex, i) =>
        `Example ${i + 1} (${ex.style}, edition ${ex.editionId}):\n${ex.body}`,
    )
    .join("\n\n---\n\n");
}
