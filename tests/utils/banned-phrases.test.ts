import { describe, it, expect } from "vitest";
import {
  BANNED_PHRASES,
  findBannedPhrases,
} from "../../src/utils/banned-phrases.js";

describe("banned-phrases", () => {
  it("exposes a non-empty list of phrases", () => {
    expect(BANNED_PHRASES.length).toBeGreaterThan(10);
  });

  it("finds a single banned phrase in a sentence", () => {
    const text = "This is a classic case of disruption in the market.";
    expect(findBannedPhrases(text)).toEqual(["disruption"]);
  });

  it("finds multiple distinct banned phrases", () => {
    const text =
      "Their holistic approach was a game-changer. We need to circle back on synergies.";
    const found = findBannedPhrases(text);
    expect(found).toContain("holistic approach");
    expect(found).toContain("game-changer");
    expect(found).toContain("circle back");
    expect(found).toContain("synergies");
  });

  it("matches case-insensitively", () => {
    const text = "Our DIGITAL TRANSFORMATION journey is ongoing.";
    expect(findBannedPhrases(text)).toContain("digital transformation");
  });

  it("only matches whole words (word boundary)", () => {
    // "leverage ai" should not match inside "leverageability"
    const text = "The leverageability of our platform is high.";
    expect(findBannedPhrases(text)).toEqual([]);
  });

  it("returns empty for clean text", () => {
    const text =
      "The owner documented the pricing rule before touching the model. Three sentences. Short ones.";
    expect(findBannedPhrases(text)).toEqual([]);
  });

  it("handles hyphenated phrases", () => {
    const text = "Our new approach is a world-class framework.";
    const found = findBannedPhrases(text);
    expect(found).toContain("world-class");
  });

  it("does not double-count the same phrase", () => {
    const text = "Disruption again. More disruption. Disruption everywhere.";
    const found = findBannedPhrases(text);
    expect(found.filter((p) => p === "disruption")).toHaveLength(1);
  });

  it("does not match substrings across word boundaries (synergy vs. antonym)", () => {
    // Contrived but prevents accidental over-matching regressions.
    const text = "Asynergy is not a word, and neither are synergiesless things.";
    const found = findBannedPhrases(text);
    // "synergy" is inside "asynergy" → word-boundary pattern should exclude
    expect(found).not.toContain("synergy");
  });
});
