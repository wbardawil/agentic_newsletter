import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { RunLedgerSchema, type RunLedger } from "../types/run-ledger.js";

const SupervisorInputSchema = z.object({
  trigger: z.enum(["schedule", "manual", "retry"]),
});
type SupervisorInput = z.infer<typeof SupervisorInputSchema>;

export class SupervisorAgent extends BaseAgent<SupervisorInput, RunLedger> {
  readonly name: AgentName = "supervisor";
  readonly inputSchema = SupervisorInputSchema;
  readonly outputSchema = RunLedgerSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: SupervisorInput,
  ): Promise<RunLedger> {
    throw new Error("SupervisorAgent.execute() not implemented");
  }
}
