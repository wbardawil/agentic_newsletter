/**
 * Utilities for parsing JSON from LLM text responses.
 * All agents must use these helpers instead of calling JSON.parse directly.
 */

/**
 * Extracts a JSON string from LLM output.
 * Strips markdown code fences if present; falls back to first `{` … last `}`.
 */
export function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
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
    throw new Error(
      "LLM response contains no text block — model returned only non-text content (e.g. tool_use)",
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
