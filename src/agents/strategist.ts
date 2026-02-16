import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { SourceBundleSchema, type SourceBundle } from "../types/source-bundle.js";
import {
  StrategicAngleSchema,
  type StrategicAngle,
} from "../types/edition.js";

const StrategistInputSchema = SourceBundleSchema;
type StrategistInput = SourceBundle;

export class StrategistAgent extends BaseAgent<StrategistInput, StrategicAngle> {
  readonly name: AgentName = "strategist";
  readonly inputSchema: z.ZodType<StrategistInput> = StrategistInputSchema;
  readonly outputSchema = StrategicAngleSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: StrategistInput,
  ): Promise<StrategicAngle> {
    throw new Error("StrategistAgent.execute() not implemented");
  }
}
