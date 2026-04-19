import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import {
  PerformanceMetricsSchema,
  type PerformanceMetrics,
} from "../types/edition.js";

const AnalystInputSchema = z.object({
  editionId: z.string().uuid(),
});
type AnalystInput = z.infer<typeof AnalystInputSchema>;

export class AnalystAgent extends BaseAgent<AnalystInput, PerformanceMetrics> {
  readonly name: AgentName = "analyst";
  readonly inputSchema = AnalystInputSchema;
  readonly outputSchema = PerformanceMetricsSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: AnalystInput,
  ): Promise<PerformanceMetrics> {
    throw new Error("AnalystAgent.execute() not implemented");
  }
}
