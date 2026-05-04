/**
 * Generate one real hero image with Gemini 2.5 Flash Image (Nano Banana).
 *
 * Reads the prompt from drafts/sample/2026-18-sample-image-prompt.txt
 * (produced by `pnpm sample`) and writes drafts/sample/2026-18-sample-hero.png.
 *
 * Cost: ~$0.04 per call. Once.
 *
 * Usage:
 *   GEMINI_API_KEY=... pnpm sample:hero
 *
 * Get a key: https://aistudio.google.com/app/apikey (free tier exists).
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SAMPLE_DIR = join(process.cwd(), "drafts", "sample");
const PROMPT_FILE = join(SAMPLE_DIR, "2026-18-sample-image-prompt.txt");
const OUTPUT_FILE = join(SAMPLE_DIR, "2026-18-sample-hero.png");
const MODEL = "gemini-2.5-flash-image-preview";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
  }>;
  error?: { message: string };
}

async function main(): Promise<void> {
  if (!existsSync(PROMPT_FILE)) {
    console.error(
      `Prompt file not found: ${PROMPT_FILE}\n` +
        "Run `pnpm sample` first to generate the synthetic edition + prompt.",
    );
    process.exit(1);
  }

  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    console.error(
      "GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/app/apikey, " +
        "then either:\n" +
        "  - export GEMINI_API_KEY=... && pnpm sample:hero  (mac/linux)\n" +
        "  - $env:GEMINI_API_KEY=\"...\"; pnpm sample:hero    (powershell)\n" +
        "  - or add GEMINI_API_KEY=... to your .env file",
    );
    process.exit(1);
  }

  const prompt = readFileSync(PROMPT_FILE, "utf-8");
  console.log(`Calling ${MODEL}...`);
  console.log(`Prompt length: ${prompt.length} chars`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const start = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Gemini returned HTTP ${response.status}:`);
    console.error(text.slice(0, 1000));
    process.exit(1);
  }

  const data = (await response.json()) as GeminiResponse;
  if (data.error) {
    console.error(`Gemini error: ${data.error.message}`);
    process.exit(1);
  }

  const inline = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  );
  if (!inline?.inlineData?.data) {
    console.error("Gemini response did not contain inline image data.");
    console.error("Response shape:", JSON.stringify(data, null, 2).slice(0, 500));
    process.exit(1);
  }

  const bytes = Buffer.from(inline.inlineData.data, "base64");
  writeFileSync(OUTPUT_FILE, bytes);

  const elapsed = Date.now() - start;
  console.log(`Wrote ${OUTPUT_FILE} (${bytes.length} bytes, ${elapsed}ms)`);
  console.log(`Open in your image viewer to see what the Designer would produce.`);
}

main().catch((err) => {
  console.error("sample-hero failed:", err);
  process.exit(1);
});
