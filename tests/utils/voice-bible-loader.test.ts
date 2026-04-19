import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadVoiceBible,
  formatVoiceBibleForPrompt,
  getVoiceBibleVersion,
} from "../../src/utils/voice-bible-loader.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const FULL_FIXTURE = join(FIXTURES, "voice-bible");
const NO_EXAMPLES_FIXTURE = join(FIXTURES, "voice-bible-no-examples");
const BAD_VERSION_FIXTURE = join(FIXTURES, "voice-bible-bad-version");

describe("loadVoiceBible", () => {
  it("loads version, content, and golden examples", () => {
    const vb = loadVoiceBible(FULL_FIXTURE);
    expect(vb.version.version).toBe("2.3.1");
    expect(vb.version.changelog).toBe("Updated tone guidelines");
    expect(vb.content).toContain("Voice Bible");
    expect(vb.goldenExamples).toHaveLength(1);
    expect(vb.goldenExamples[0]?.filename).toBe("2026-07-en.md");
  });

  it("skips README.md in golden-examples", () => {
    const vb = loadVoiceBible(FULL_FIXTURE);
    const names = vb.goldenExamples.map((e) => e.filename);
    expect(names).not.toContain("README.md");
  });

  it("returns empty goldenExamples when directory is missing", () => {
    const vb = loadVoiceBible(NO_EXAMPLES_FIXTURE);
    expect(vb.goldenExamples).toHaveLength(0);
  });

  it("throws on invalid version.json schema", () => {
    expect(() => loadVoiceBible(BAD_VERSION_FIXTURE)).toThrow();
  });

  it("sorts golden examples by filename", () => {
    const vb = loadVoiceBible(FULL_FIXTURE);
    const names = vb.goldenExamples.map((e) => e.filename);
    expect(names).toEqual([...names].sort());
  });

  it("version.changelog is optional", () => {
    const vb = loadVoiceBible(NO_EXAMPLES_FIXTURE);
    expect(vb.version.changelog).toBeUndefined();
  });
});

describe("formatVoiceBibleForPrompt", () => {
  it("wraps content in voice_bible tags with version attribute", () => {
    const vb = loadVoiceBible(FULL_FIXTURE);
    const formatted = formatVoiceBibleForPrompt(vb);
    expect(formatted).toContain('<voice_bible version="2.3.1">');
    expect(formatted).toContain("</voice_bible>");
  });

  it("includes golden_examples section when examples exist", () => {
    const vb = loadVoiceBible(FULL_FIXTURE);
    const formatted = formatVoiceBibleForPrompt(vb);
    expect(formatted).toContain("<golden_examples>");
    expect(formatted).toContain('filename="2026-07-en.md"');
    expect(formatted).toContain("</golden_examples>");
  });

  it("omits golden_examples section when no examples", () => {
    const vb = loadVoiceBible(NO_EXAMPLES_FIXTURE);
    const formatted = formatVoiceBibleForPrompt(vb);
    expect(formatted).not.toContain("<golden_examples>");
  });

  it("includes voice bible content in output", () => {
    const vb = loadVoiceBible(FULL_FIXTURE);
    const formatted = formatVoiceBibleForPrompt(vb);
    expect(formatted).toContain("Voice Bible");
  });
});

describe("getVoiceBibleVersion", () => {
  it("returns the version string", () => {
    expect(getVoiceBibleVersion(FULL_FIXTURE)).toBe("2.3.1");
  });

  it("returns version from no-examples fixture", () => {
    expect(getVoiceBibleVersion(NO_EXAMPLES_FIXTURE)).toBe("1.0.0");
  });

  it("throws on invalid version.json", () => {
    expect(() => getVoiceBibleVersion(BAD_VERSION_FIXTURE)).toThrow();
  });
});
