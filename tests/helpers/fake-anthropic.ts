/**
 * Minimal fake of the Anthropic SDK for integration tests.
 *
 * Agents call either `anthropic.messages.stream(...)` → `stream.finalMessage()`
 * or `anthropic.messages.create(...)`. Both paths end up returning a message
 * object with `content` (array of content blocks) and `usage` (token counts).
 *
 * The fake accepts a queue of prepared text responses. Each call dequeues one
 * response and returns it wrapped in the right shape. Tests assemble a
 * pipeline by queuing the exact JSON/text each agent is expected to emit.
 */

export interface FakeResponseSpec {
  /** The text the fake message will contain in `content[0].text`. */
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface FakeAnthropic {
  messages: {
    create: (_args: unknown) => Promise<FakeMessage>;
    stream: (_args: unknown) => Promise<FakeStream>;
  };
  /** Push a response to the front of the queue (next to be returned). */
  enqueue: (spec: FakeResponseSpec) => void;
  /** How many responses have been consumed so far. */
  calls: () => number;
  /** Throws if any queued responses remain unconsumed — useful for end-of-test. */
  assertDrained: () => void;
  /** The prompts each call received, in order, for assertion. */
  promptsReceived: unknown[];
}

interface FakeMessage {
  content: Array<{ type: "text"; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

interface FakeStream {
  finalMessage: () => Promise<FakeMessage>;
}

export function createFakeAnthropic(
  initialQueue: FakeResponseSpec[] = [],
): FakeAnthropic {
  const queue: FakeResponseSpec[] = [...initialQueue];
  const prompts: unknown[] = [];

  function take(): FakeMessage {
    const spec = queue.shift();
    if (!spec) {
      throw new Error(
        "FakeAnthropic: queue exhausted — more Anthropic calls than responses provided",
      );
    }
    return {
      content: [{ type: "text", text: spec.text }],
      usage: {
        input_tokens: spec.inputTokens ?? 1000,
        output_tokens: spec.outputTokens ?? 500,
      },
    };
  }

  return {
    messages: {
      create: async (args: unknown) => {
        prompts.push(args);
        return take();
      },
      stream: async (args: unknown) => {
        prompts.push(args);
        const msg = take();
        return {
          finalMessage: async () => msg,
        };
      },
    },
    enqueue: (spec) => queue.push(spec),
    calls: () => prompts.length,
    assertDrained: () => {
      if (queue.length > 0) {
        throw new Error(
          `FakeAnthropic: ${queue.length} response(s) remained unused at end of test`,
        );
      }
    },
    promptsReceived: prompts,
  };
}
