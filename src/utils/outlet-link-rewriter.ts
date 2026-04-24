import type { SourceBundle } from "../types/source-bundle.js";
import type { LocalizedContent } from "../types/edition.js";

/**
 * Rewrite generic "[Read ->](url)" / "[Leer ->](url)" anchors into
 * "[Read in Bloomberg ->](url)" / "[Leer en Expansión ->](url)" so the
 * reader sees the outlet before tapping. Runs as a deterministic
 * post-processor on Writer and Localizer output.
 *
 * If a URL is not found in the SourceBundle (or has no outlet), the
 * anchor is left untouched — fabricating an outlet would be the same
 * trust-breaking move citation discipline exists to prevent.
 */

type LinkPattern = {
  verb: "Read" | "Leer";
  preposition: "in" | "en";
};

const EN_PATTERN: LinkPattern = { verb: "Read", preposition: "in" };
const ES_PATTERN: LinkPattern = { verb: "Leer", preposition: "en" };

function outletForUrl(bundle: SourceBundle, url: string): string | undefined {
  const item = bundle.items.find((i) => i.url === url);
  return item?.outlet;
}

export function rewriteOutletLinks(
  body: string,
  bundle: SourceBundle,
  language: "en" | "es",
): string {
  const pattern = language === "en" ? EN_PATTERN : ES_PATTERN;
  // Match both `[Read ->]` / `[Leer ->]` and `[Read]` / `[Leer]` without the
  // arrow — the ES Writer has shipped both shapes. The arrow is optional so
  // either variant gets the outlet name appended. Preserves the input
  // arrow-or-no-arrow choice in the output only when no outlet is found.
  const re = new RegExp(
    `\\[${pattern.verb}(?:\\s*->)?\\]\\(([^)]+)\\)`,
    "g",
  );

  return body.replace(re, (match, url: string) => {
    const outlet = outletForUrl(bundle, url);
    if (!outlet) return match;
    return `[${pattern.verb} ${pattern.preposition} ${outlet} ->](${url})`;
  });
}

export function rewriteContentOutletLinks(
  content: LocalizedContent,
  bundle: SourceBundle,
  language: "en" | "es",
): LocalizedContent {
  return {
    ...content,
    sections: content.sections.map((s) => ({
      ...s,
      body: rewriteOutletLinks(s.body, bundle, language),
    })),
  };
}
