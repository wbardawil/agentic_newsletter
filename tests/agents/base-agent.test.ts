import { describe, it, expect } from "vitest";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { BaseAgent, type AgentDeps } from "../../src/agents/base-agent.js";
import type { AgentName } from "../../src/types/enums.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { createLogger } from "../../src/utils/logger.js";
import { createCostTracker } from "../../src/utils/cost-tracker.js";

const TestInputSchema = z.object({ value: z.string() });
const TestOutputSchema = z.object({ result: z.string() });
type TestInput = z.infer<typeof TestInputSchema>;
type TestOutput = z.infer<typeof TestOutputSchema>;

class TestAgent extends BaseAgent<TestInput, TestOutput> {
  readonly name: AgentName = "radar";
  readonly inputSchema = TestInputSchema;
  readonly outputSchema = TestOutputSchema;

  private handler: (payload: TestInput) => Promise<TestOutput>;

  constructor(deps: AgentDeps, handler: (payload: TestInput) => Promise<TestOutput>) {
    super(deps);
    this.handler = handler;
  }

  protected async execute(payload: TestInput): Promise<TestOutput> {
    return this.handler(payload);
  }
}

function makeDeps(): AgentDeps {
  return {
    logger: createLogger("error"),
    costTracker: createCostTracker(),
  };
}

function makeInput(payload: TestInput): AgentInput<TestInput> {
  return {
    runId: randomUUID(),
    editionId: "2026-W08",
    agentName: "radar",
    payload,
  };
}

describe("BaseAgent", () => {
  it("validates input and returns successful AgentOutput", async () => {
    const agent = new TestAgent(makeDeps(), async (p) => ({
      result: p.value.toUpperCase(),
    }));

    const output = await agent.run(makeInput({ value: "hello" }));

    expect(output.status).toBe("success");
    expect(output.errors).toEqual([]);
    expect(output.data.result).toBe("HELLO");
    expect(output.agentName).toBe("radar");
    expect(output.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.timestamp).toBeDefined();
    expect(output.cost).toBeDefined();
    expect(output.tokens).toBeDefined();
  });

  it("rejects invalid input", async () => {
    const agent = new TestAgent(makeDeps(), async () => ({ result: "ok" }));

    const input = makeInput({ value: 123 } as unknown as TestInput);
    await expect(agent.run(input)).rejects.toThrow();
  });

  it("returns error status when execute throws", async () => {
    const agent = new TestAgent(makeDeps(), async () => {
      throw new Error("test failure");
    });

    const output = await agent.run(makeInput({ value: "test" }));

    expect(output.status).toBe("error");
    expect(output.errors).toContain("test failure");
  });

  it("measures duration", async () => {
    const agent = new TestAgent(makeDeps(), async (p) => {
      await new Promise((r) => setTimeout(r, 50));
      return { result: p.value };
    });

    const output = await agent.run(makeInput({ value: "test" }));

    expect(output.durationMs).toBeGreaterThanOrEqual(40);
  });
});
