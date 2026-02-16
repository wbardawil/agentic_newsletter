import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { SourceBundleSchema, type SourceBundle } from "../types/source-bundle.js";

const RadarInputSchema = z.object({
  timeWindowHours: z.number().positive(),
  maxItems: z.number().int().positive(),
  focusTopics: z.array(z.string()).optional(),
});
type RadarInput = z.infer<typeof RadarInputSchema>;

export class RadarAgent extends BaseAgent<RadarInput, SourceBundle> {
  readonly name: AgentName = "radar";
  readonly inputSchema = RadarInputSchema;
  readonly outputSchema = SourceBundleSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(_payload: RadarInput): Promise<SourceBundle> {
    throw new Error("RadarAgent.execute() not implemented");
  }
}
