import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface Correction {
  en: string;
  avoid: string;
  prefer: string;
  note?: string;
  addedAt: string;
}

interface LocalizationMemory {
  corrections: Correction[];
  vocabulary: Array<{ concept: string; prefer: string; note?: string }>;
  toneNotes: string[];
}

const MEMORY_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "config",
  "localization-memory.json",
);

export function loadLocalizationMemory(): LocalizationMemory {
  if (!existsSync(MEMORY_PATH)) {
    return { corrections: [], vocabulary: [], toneNotes: [] };
  }
  return JSON.parse(readFileSync(MEMORY_PATH, "utf-8")) as LocalizationMemory;
}

export function formatLocalizationMemoryForPrompt(memory: LocalizationMemory): string {
  const lines: string[] = [];

  if (memory.corrections.length > 0) {
    lines.push("**Word/phrase corrections from Wadi's feedback:**");
    for (const c of memory.corrections) {
      lines.push(`- "${c.en}" → avoid "${c.avoid}" → prefer "${c.prefer}"`);
      if (c.note) lines.push(`  (${c.note})`);
    }
  }

  if (memory.vocabulary.length > 0) {
    lines.push("");
    lines.push("**Preferred vocabulary:**");
    for (const v of memory.vocabulary) {
      lines.push(`- ${v.concept} → prefer "${v.prefer}"`);
      if (v.note) lines.push(`  (${v.note})`);
    }
  }

  if (memory.toneNotes.length > 0) {
    lines.push("");
    lines.push("**Tone notes:**");
    for (const n of memory.toneNotes) {
      lines.push(`- ${n}`);
    }
  }

  return lines.length > 0
    ? lines.join("\n")
    : "(No localization preferences recorded yet.)";
}
