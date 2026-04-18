import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const VoiceBibleVersionSchema = z.object({
  version: z.string().min(1),
  updatedAt: z.string().min(1),
  changelog: z.string().optional(),
});

export type VoiceBibleVersion = z.infer<typeof VoiceBibleVersionSchema>;

export interface GoldenExample {
  filename: string;
  content: string;
}

export interface VoiceBible {
  version: VoiceBibleVersion;
  content: string;
  goldenExamples: GoldenExample[];
}

const DEFAULT_VOICE_BIBLE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "voice-bible",
);

export function loadVoiceBible(voiceBibleDir?: string): VoiceBible {
  const dir = voiceBibleDir ?? DEFAULT_VOICE_BIBLE_DIR;

  const versionRaw = JSON.parse(
    readFileSync(join(dir, "version.json"), "utf-8"),
  ) as unknown;
  const version = VoiceBibleVersionSchema.parse(versionRaw);

  const content = readFileSync(join(dir, "voice-bible.md"), "utf-8");

  const goldenExamples: GoldenExample[] = [];
  const examplesDir = join(dir, "golden-examples");
  try {
    const entries = readdirSync(examplesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "README.md"
      ) {
        goldenExamples.push({
          filename: entry.name,
          content: readFileSync(join(examplesDir, entry.name), "utf-8"),
        });
      }
    }
    goldenExamples.sort((a, b) => a.filename.localeCompare(b.filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return { version, content, goldenExamples };
}

export function formatVoiceBibleForPrompt(vb: VoiceBible): string {
  const parts: string[] = [
    `<voice_bible version="${vb.version.version}">`,
    vb.content,
    "</voice_bible>",
  ];

  if (vb.goldenExamples.length > 0) {
    parts.push("<golden_examples>");
    for (const example of vb.goldenExamples) {
      parts.push(`<example filename="${example.filename}">`);
      parts.push(example.content);
      parts.push("</example>");
    }
    parts.push("</golden_examples>");
  }

  return parts.join("\n");
}

export function getVoiceBibleVersion(voiceBibleDir?: string): string {
  const dir = voiceBibleDir ?? DEFAULT_VOICE_BIBLE_DIR;
  const versionRaw = JSON.parse(
    readFileSync(join(dir, "version.json"), "utf-8"),
  ) as unknown;
  const parsed = VoiceBibleVersionSchema.parse(versionRaw);
  return parsed.version;
}
