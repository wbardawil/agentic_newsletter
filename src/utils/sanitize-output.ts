/**
 * Strip AI-tell punctuation from generated text.
 *
 * Em-dashes (—) and en-dashes (–) are strong giveaways that a piece of
 * writing came from an LLM. Readers notice. We normalize both to a
 * regular hyphen (-) on every agent output before the content hits
 * disk, so the draft JSON, rendered markdown, and apertura history
 * all stay clean.
 *
 * Also strips two render bugs caught in production:
 * - Nested markdown links: `[[text](url1)](url2)` → `[text](url2)`.
 *   The Writer occasionally produces a markdown-formatted link AS the
 *   link text of an outer link. Most renderers mishandle the result.
 *   Caught in 2026-19 Tool URLs (Loom + Notion).
 * - Internal section-type labels: lines like `Sección: spotlight` or
 *   `Section: lead` that the Localizer leaks into rendered prose. Caught
 *   in 2026-18 (`## Spotlight` duplicate heading) and 2026-19
 *   (`Sección: spotlight` line).
 *
 * This is applied inside the Writer and Localizer return paths — every
 * section body, heading, subject, and preheader passes through before
 * the LocalizedContent leaves the agent.
 */

import type { LocalizedContent } from "../types/edition.js";

/**
 * Flatten nested markdown links — `[[text](innerUrl)](outerUrl)` becomes
 * `[text](outerUrl)`. The outer URL wins because it's the one the writer
 * deliberately wrapped; the inner URL is usually a stray autoformatter
 * artifact (e.g. plain `loom.com` autolink that got nested).
 */
function flattenNestedLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\([^)]+\)\]\(([^)]+)\)/g, "[$1]($2)");
}

/**
 * Strip lines that look like internal section-type labels leaked into
 * the visible prose. The Localizer occasionally emits the section's
 * type identifier as a markdown line — we catch the ones we've seen.
 */
function stripInternalSectionLabels(text: string): string {
  // "Sección: spotlight" or "Section: lead" — case-insensitive label,
  // followed by a known section type keyword. Strip the entire line.
  const labelLineRe =
    /^[ \t]*(?:Sección|Section)[ \t]*:[ \t]*(?:lead|news|analysis|spotlight|tool|quickTakes|cta)[ \t]*$/gim;
  // Also catch "## Spotlight" / "## Lead" etc. when they appear as a
  // duplicate H2 header beneath an already-rendered section heading.
  const duplicateHeaderRe =
    /^##[ \t]+(?:Spotlight|Lead|News|Analysis|Tool|QuickTakes|Cta)[ \t]*$/gim;
  return text
    .replace(labelLineRe, "")
    .replace(duplicateHeaderRe, "")
    // collapse the now-blank-line gaps
    .replace(/\n{3,}/g, "\n\n");
}

export function stripAiTells(text: string): string {
  let out = text.replace(/—/g, "-").replace(/–/g, "-");
  out = flattenNestedLinks(out);
  out = stripInternalSectionLabels(out);
  return out;
}

export function sanitizeLocalizedContent(
  content: LocalizedContent,
): LocalizedContent {
  return {
    ...content,
    subject: stripAiTells(content.subject),
    preheader: stripAiTells(content.preheader),
    sections: content.sections.map((s) => ({
      ...s,
      heading: stripAiTells(s.heading),
      body: stripAiTells(s.body),
    })),
  };
}
