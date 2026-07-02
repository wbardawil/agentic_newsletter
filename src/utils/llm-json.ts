/**
 * Utilities for parsing JSON from LLM text responses.
 * All agents must use these helpers instead of calling JSON.parse directly.
 */

/**
 * Extracts a JSON string from LLM output.
 * Strips markdown code fences if present; falls back to first `{` … last `}`.
 *
 * Handles both:
 * - ` ```json\n{…}\n``` ` (opening fence with optional language tag)
 * - ` ```\n{…}\n``` ` (plain fence)
 * - Trailing ` ``` ` appended after a complete JSON object
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  // Full-fence match: ```[json]\n…\n```
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();

  // Partial-fence: model emitted JSON followed by ``` (no opening fence)
  const trailingFence = trimmed.endsWith("```")
    ? trimmed.slice(0, trimmed.lastIndexOf("```")).trim()
    : null;
  if (trailingFence) {
    const s = trailingFence.indexOf("{");
    const e = trailingFence.lastIndexOf("}");
    if (s !== -1 && e !== -1 && e > s) return trailingFence.slice(s, e + 1);
  }

  // Plain fallback: extract from first { to last }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * Extracts concatenated text from an LLM message's content blocks.
 * Throws if no text block is present (e.g. only tool_use blocks returned).
 */
export function extractTextFromMessage(
  content: Array<{ type: string; text?: string }>,
): string {
  const texts = content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text);
  if (texts.length === 0) {
    const blockTypes = content.map((b) => b.type).join(", ") || "(empty)";
    throw new Error(
      `LLM response contains no text block — got only: [${blockTypes}]. ` +
        `Likely cause: max_tokens exhausted by thinking blocks. Raise max_tokens or reduce thinking effort.`,
    );
  }
  return texts.join("");
}

/**
 * Extracts JSON from LLM output and parses it.
 * Throws a descriptive error (not a bare SyntaxError) on malformed JSON.
 *
 * @param rawText  The full LLM text output.
 * @param label    Agent/context label included in error messages.
 */
export function parseLlmJson(rawText: string, label: string): unknown {
  const jsonStr = extractJson(rawText);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `${label}: malformed JSON in LLM response — ` +
        `${err instanceof Error ? err.message : String(err)}\n` +
        `First 200 chars of raw output: ${rawText.slice(0, 200)}`,
    );
  }
}
