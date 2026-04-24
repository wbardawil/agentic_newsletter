import { describe, it, expect } from "vitest";
import { ZodError, z } from "zod";
import { isRetryable } from "../../src/utils/retry.js";

describe("isRetryable", () => {
  it("returns false for ZodError (schema mismatch is not transient)", () => {
    let zodErr: ZodError;
    try {
      z.string().parse(42);
      throw new Error("expected parse to throw");
    } catch (e) {
      zodErr = e as ZodError;
    }
    expect(isRetryable(zodErr)).toBe(false);
  });

  it("returns false for config errors", () => {
    expect(isRetryable(new Error("ANTHROPIC_API_KEY must be set to continue"))).toBe(false);
    expect(isRetryable(new Error("Invalid --edition value"))).toBe(false);
    expect(isRetryable(new Error("not implemented yet"))).toBe(false);
  });

  it("returns false for 'no text block' errors (deterministic API shape issue)", () => {
    expect(isRetryable(new Error("Anthropic response had no text block"))).toBe(false);
  });

  it("returns true for malformed JSON (LLM generation is non-deterministic, retry helps)", () => {
    const err = new Error(
      'WriterAgent: malformed JSON in LLM response — Expected \',\' or \'}\' after property value in JSON at position 8035',
    );
    expect(isRetryable(err)).toBe(true);
  });

  it("returns false for Beehiiv 4xx client errors (except 429)", () => {
    expect(isRetryable(new Error("Beehiiv API error 400: Bad Request"))).toBe(false);
    expect(isRetryable(new Error("Beehiiv API error 403: Forbidden"))).toBe(false);
    expect(isRetryable(new Error("Beehiiv API error 404: Not Found"))).toBe(false);
  });

  it("returns true for Beehiiv 429 rate limits", () => {
    expect(isRetryable(new Error("Beehiiv API error 429: Too Many Requests"))).toBe(true);
  });

  it("returns true for Beehiiv 5xx server errors", () => {
    expect(isRetryable(new Error("Beehiiv API error 503: Service Unavailable"))).toBe(true);
  });

  it("returns true for Anthropic 529 overloaded", () => {
    expect(isRetryable(new Error('529 {"type":"error","error":{"type":"overloaded_error"}}'))).toBe(true);
  });

  it("returns true for network timeouts and unknown errors (default-retry)", () => {
    expect(isRetryable(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryable(new Error("socket hang up"))).toBe(true);
    expect(isRetryable(new Error("something went wrong"))).toBe(true);
  });
});
