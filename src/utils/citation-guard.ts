/**
 * Deterministic citation guard — catches obvious attribution-without-source patterns.
 *
 * Scans a newsletter section body for patterns like:
 *   "Grupo Elektra ha documentado..."   (Company + attribution verb, no URL)
 *   "Según Bimbo, el 40% de..."          (Attribution + Company, no URL)
 *   "CEO John Smith said..."             (Person + said/told/reported, no URL)
 *
 * Flags each occurrence as a CitationIssue. Safe to run on both English
 * and Spanish text. Does not use LLM — cheap, fast, 100% deterministic.
 *
 * Intended as a second line of defense after the Quality Gate. If the LLM
 * slips through the fact-verification check, the regex guard catches the
 * classic shapes of fabricated attribution.
 */

export interface CitationIssue {
  /** The sentence or excerpt that triggered the guard. */
  excerpt: string;
  /** The entity (company / person) the guard believes is being attributed to. */
  entity: string;
  /** The attribution verb found adjacent to the entity. */
  verb: string;
  /** Section hint ("en/insight", "es/fieldReport", etc.). */
  section: string;
}

// Attribution verbs in English and Spanish that typically signal a claim.
// Matched case-insensitively at word boundaries.
const ATTRIBUTION_VERBS = [
  // English
  "said",
  "told",
  "reported",
  "announced",
  "stated",
  "confirmed",
  "documented",
  "revealed",
  "disclosed",
  "published",
  "claimed",
  "found",
  "showed",
  "demonstrated",
  "admitted",
  "testified",
  // Spanish
  "dijo",
  "declaró",
  "declaro",
  "informó",
  "informo",
  "reportó",
  "reporto",
  "anunció",
  "anuncio",
  "afirmó",
  "afirmo",
  "confirmó",
  "confirmo",
  "documentó",
  "documento",
  "reveló",
  "revelo",
  "publicó",
  "publico",
  "demostró",
  "demostro",
  "admitió",
  "admitio",
  "ha documentado",
  "ha reportado",
  "ha anunciado",
  "ha declarado",
  "ha confirmado",
  "ha publicado",
  "ha afirmado",
];

const VERB_ALT = ATTRIBUTION_VERBS.map((v) => v.replace(/\s+/g, "\\s+")).join(
  "|",
);

// Capitalized word (2+ letters) possibly followed by 1-3 more capitalized words.
// Intentionally conservative — misses all-caps names like "IBM" (safer to allow).
const ENTITY_PATTERN = "([A-Z][\\w\\-áéíóúñÁÉÍÓÚÑ]{1,}(?:\\s+[A-Z][\\w\\-áéíóúñÁÉÍÓÚÑ]{1,}){0,3})";

// Pattern 1: Entity + verb  (e.g. "Grupo Elektra ha documentado")
const PATTERN_ENTITY_VERB = new RegExp(
  `\\b${ENTITY_PATTERN}\\s+(${VERB_ALT})\\b`,
  "gi",
);

// Pattern 2: "According to <Entity>" / "Según <Entity>"
const PATTERN_ACCORDING_TO = new RegExp(
  `\\b(?:according to|según|segun|de acuerdo con|de acuerdo a)\\s+${ENTITY_PATTERN}\\b`,
  "gi",
);

// Markdown link pattern — used to check whether a citation URL is adjacent.
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

// Words that are NOT entities — pronouns, sentence connectives, etc.
// If the matched "entity" starts with one of these, strip it or skip entirely.
const STOP_WORDS_LEADING = new Set([
  // English pronouns / connectives
  "You",
  "He",
  "She",
  "They",
  "We",
  "I",
  "It",
  "And",
  "But",
  "Or",
  "So",
  "Then",
  "Now",
  "Still",
  "Yet",
  "Later",
  "Here",
  "There",
  "This",
  "That",
  "These",
  "Those",
  "Most",
  "Some",
  "Many",
  // Spanish pronouns / connectives
  "Tu",
  "Tú",
  "Usted",
  "Ustedes",
  "Él",
  "El",
  "Ella",
  "Ellos",
  "Ellas",
  "Nosotros",
  "Y",
  "Pero",
  "O",
  "Entonces",
  "Ahora",
  "Aquí",
  "Allí",
  "Este",
  "Esta",
  "Estos",
  "Estas",
  "Más",
  "Mas",
  "Algunos",
  "Muchos",
]);

// Substrings that, if present in the captured entity, mark it as non-claim-bearing.
// Covers OS pillar names, newsletter section labels, and geographic references
// — they may appear capitalized but never represent a cite-worthy attribution.
const ALLOWED_SUBSTRINGS = [
  "Strategy OS",
  "Operating Model OS",
  "Technology OS",
  "Business Transformation OS",
  "The Machine",
  "The Letter",
  "Transformation Letter",
  "The Apertura",
  "The Insight",
  "The Field Report",
  "The Compass",
  "The Door",
  "La Apertura",
  "El Insight",
  "El Reporte",
  "La Brújula",
  "La Puerta",
  "Wadi",
  "United States",
  "Latin America",
  "Latinoamérica",
  "LATAM",
];

function normalizeEntity(raw: string): string {
  // Strip a leading stop word if present (e.g. "And Grupo Elektra" → "Grupo Elektra")
  const words = raw.split(/\s+/);
  while (words.length > 1 && STOP_WORDS_LEADING.has(words[0]!)) {
    words.shift();
  }
  return words.join(" ").trim();
}

function isAllowedEntity(entity: string): boolean {
  if (STOP_WORDS_LEADING.has(entity)) return true;
  return ALLOWED_SUBSTRINGS.some((s) => entity.includes(s));
}

/**
 * Returns the position of the nearest markdown link to the given index.
 * Used to check if an attribution pattern has a citation nearby (within `window` chars).
 */
function hasNearbyLink(body: string, matchStart: number, window = 250): boolean {
  MARKDOWN_LINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKDOWN_LINK.exec(body)) !== null) {
    const distance = Math.abs(m.index - matchStart);
    if (distance <= window) return true;
  }
  return false;
}

/**
 * Scan a single section body for attribution-without-citation patterns.
 */
export function scanSection(body: string, sectionLabel: string): CitationIssue[] {
  const issues: CitationIssue[] = [];
  const seen = new Set<string>();

  for (const pattern of [PATTERN_ENTITY_VERB, PATTERN_ACCORDING_TO]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      const fullMatch = match[0];
      const rawEntity = match[1]?.trim() ?? "";
      const verb = (match[2]?.trim() ?? "(according to)").toLowerCase();

      // The 'i' flag on the regex makes [A-Z] match lowercase too. Re-validate
      // post-match: every word in the entity must actually start with uppercase.
      const wordsOk = rawEntity
        .split(/\s+/)
        .every((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w));
      if (!wordsOk) continue;

      const entity = normalizeEntity(rawEntity);
      if (!entity || isAllowedEntity(entity)) continue;

      // Dedup — if we've already flagged this entity+verb pair in this section
      const key = `${entity.toLowerCase()}|${verb}`;
      if (seen.has(key)) continue;

      // If there's a markdown link within ~250 chars, treat as cited
      if (hasNearbyLink(body, match.index)) continue;

      seen.add(key);
      const excerptStart = Math.max(0, match.index - 40);
      const excerptEnd = Math.min(body.length, match.index + fullMatch.length + 40);
      const excerpt = body.slice(excerptStart, excerptEnd).replace(/\s+/g, " ").trim();

      issues.push({ excerpt, entity, verb, section: sectionLabel });
    }
  }

  return issues;
}

/**
 * Scan all sections of a newsletter (EN or ES).
 * `sections` is a map of sectionType → body text.
 */
export function scanEdition(
  sections: Array<{ type: string; body: string }>,
  language: "en" | "es",
): CitationIssue[] {
  const issues: CitationIssue[] = [];
  for (const { type, body } of sections) {
    issues.push(...scanSection(body, `${language}/${type}`));
  }
  return issues;
}
