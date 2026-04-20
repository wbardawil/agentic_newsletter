/**
 * Strip AI-tell punctuation from generated text.
 *
 * Em-dashes (—) and en-dashes (–) are strong giveaways that a piece of
 * writing came from an LLM. Readers notice. We normalize both to a
 * regular hyphen (-) on every agent output before the content hits
 * disk, so the draft JSON, rendered markdown, and apertura history
 * all stay clean.
 *
 * This is applied inside the Writer and Localizer return paths — every
 * section body, heading, subject, and preheader passes through before
 * the LocalizedContent leaves the agent.
 */

import type { LocalizedContent } from "../types/edition.js";

export function stripAiTells(text: string): string {
  return text.replace(/—/g, "-").replace(/–/g, "-");
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
