import { readFile } from "node:fs/promises";
import path from "node:path";

let cached: string | null = null;

/**
 * Reads the Voice Bible markdown checked into the parent repo. Cached in
 * memory after the first read so we do not hit disk on every chat request.
 */
export async function loadVoiceBible(): Promise<string> {
  if (cached) return cached;
  const candidatePaths = [
    path.join(process.cwd(), "..", "src", "voice-bible", "voice-bible.md"),
    path.join(process.cwd(), "src", "voice-bible", "voice-bible.md"),
  ];
  for (const p of candidatePaths) {
    try {
      cached = await readFile(p, "utf-8");
      return cached;
    } catch {
      // try next
    }
  }
  cached = "";
  return cached;
}
