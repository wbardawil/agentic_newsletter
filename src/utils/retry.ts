import { ZodError } from "zod";

/**
 * Returns true if the error is worth retrying.
 * Config errors, schema errors, and explicit bad-request errors are not retried.
 */
export function isRetryable(err: Error): boolean {
  if (err instanceof ZodError) return false;
  const msg = err.message;
  // Non-retryable: explicit programming/config errors
  if (/must be set to|Invalid --edition|malformed JSON|no text block|not implemented/i.test(msg)) {
    return false;
  }
  // Non-retryable: Beehiiv/external 4xx client errors (except 429)
  if (/Beehiiv API error 4[0-9][0-9]/.test(msg) && !/429/.test(msg)) return false;
  // Everything else (network, 429, 5xx, LLM timeouts) is worth retrying
  return true;
}

export interface RetryOptions {
  maxAttempts?: number;
  /** Delay before first retry in ms (subsequent delays are doubled). */
  baseDelayMs?: number;
  label?: string;
  onRetry?: (attempt: number, err: Error, delayMs: number) => void;
}

/**
 * Retries an async operation with exponential backoff.
 *
 * @param fn         The async operation to retry.
 * @param options    Retry configuration.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    label = "operation",
    onRetry,
  } = options;

  let lastError!: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts || !isRetryable(lastError)) throw lastError;

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      onRetry?.(attempt, lastError, delayMs);
      process.stderr.write(
        `[retry] ${label}: attempt ${attempt}/${maxAttempts} failed — ${lastError.message}. ` +
          `Retrying in ${delayMs}ms...\n`,
      );
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError;
}
