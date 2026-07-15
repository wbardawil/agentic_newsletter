/**
 * Re-render every drafts/<edition>-{en,es}.html from its markdown source
 * using the current brand template (src/utils/edition-html.ts).
 *
 * The markdown files are the editorial source of truth (they may carry
 * human edits made on the PR branch), so this script re-skins without
 * touching copy. Subjects for the <title> tag come from the edition's
 * -draft.json when present.
 *
 * Usage:
 *   pnpm rerender:html
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderEditionHtml } from "../utils/edition-html.js";

const draftsDir = join(process.cwd(), "drafts");

let count = 0;
for (const file of readdirSync(draftsDir)) {
  const m = file.match(/^(.+)-(en|es)\.md$/);
  if (!m) continue;
  const editionId = m[1] as string;
  const language = m[2] as "en" | "es";

  const markdown = readFileSync(join(draftsDir, file), "utf-8");

  let title = `The Transformation Letter — ${editionId} [${language.toUpperCase()}]`;
  const draftPath = join(draftsDir, `${editionId}-draft.json`);
  if (existsSync(draftPath)) {
    try {
      const draft = JSON.parse(readFileSync(draftPath, "utf-8")) as {
        enContent?: { subject?: string };
        esContent?: { subject?: string } | null;
      };
      const subject = language === "es" ? draft.esContent?.subject : draft.enContent?.subject;
      if (subject) title = subject;
    } catch {
      // Unparseable draft.json — keep the fallback title.
    }
  }

  // Keep any hero imagery: if the Designer (or a manual drop) left an image
  // named <editionId>-hero.<ext> next to the drafts, embed it.
  let hero: { filename: string; altText: string; caption: string } | undefined;
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const heroFile = `${editionId}-hero.${ext}`;
    if (existsSync(join(draftsDir, heroFile))) {
      hero = { filename: heroFile, altText: title, caption: "" };
      break;
    }
  }

  const html = renderEditionHtml({ editionId, title, markdown, language, hero });
  writeFileSync(join(draftsDir, `${editionId}-${language}.html`), html, "utf-8");
  console.log(`re-rendered ${editionId}-${language}.html`);
  count++;
}

console.log(`\n${count} edition pages re-rendered with the brand template.`);
