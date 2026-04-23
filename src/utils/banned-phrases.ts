/**
 * Shared banned-phrase detection.
 *
 * The Validator uses this to flag issues post-hoc. The Writer uses it
 * pre-return to trigger a targeted repair pass so banned phrases never
 * reach the draft in the first place.
 *
 * The list captures voice-bible violations (consultant jargon, cliché
 * phrases, and worn-out business-speak). It is case-insensitive and
 * matched on word boundaries so "leverage" as a verb fires but "leveraging
 * effect" still can't hide.
 *
 * Adding a phrase here immediately widens the Writer's repair scope and
 * the Validator's error scope — the single source of truth.
 */

export const BANNED_PHRASES: readonly string[] = [
  "digital transformation",
  "leverage ai",
  "ai-powered",
  "disruptive",
  "disruption",
  "synergy",
  "synergies",
  "best practices",
  "low-hanging fruit",
  "move the needle",
  "scalable solution",
  "going forward",
  "value-add",
  "holistic approach",
  "thought leader",
  "thought leadership",
  "game-changer",
  "game changer",
  "circle back",
  "boil the ocean",
  "take it to the next level",
  "world-class",
];

let _patterns: RegExp[] | null = null;

function getPatterns(): RegExp[] {
  if (_patterns) return _patterns;
  _patterns = BANNED_PHRASES.map(
    (phrase) =>
      new RegExp(
        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      ),
  );
  return _patterns;
}

/** Returns the banned phrases that appear in `text`. Order matches BANNED_PHRASES. */
export function findBannedPhrases(text: string): string[] {
  const patterns = getPatterns();
  return BANNED_PHRASES.filter((_, i) => patterns[i]?.test(text));
}
