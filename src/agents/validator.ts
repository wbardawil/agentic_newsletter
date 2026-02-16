import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import {
  LocalizedContentSchema,
  ValidationResultSchema,
  type ValidationResult,
} from "../types/edition.js";

const ValidatorInputSchema = z.object({
  content: z.array(LocalizedContentSchema).min(1),
});
type ValidatorInput = z.infer<typeof ValidatorInputSchema>;

export class ValidatorAgent extends BaseAgent<ValidatorInput, ValidationResult> {
  readonly name: AgentName = "validator";
  readonly inputSchema = ValidatorInputSchema;
  readonly outputSchema = ValidationResultSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: ValidatorInput,
  ): Promise<ValidationResult> {
    throw new Error("ValidatorAgent.execute() not implemented");
  }
}
