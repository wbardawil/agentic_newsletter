import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import {
  EditionSchema,
  DistributionRecordSchema,
  type DistributionRecord,
} from "../types/edition.js";

const DistributorInputSchema = z.object({
  edition: EditionSchema,
  channels: z.array(z.enum(["beehiiv", "linkedin", "twitter"])).min(1),
});
type DistributorInput = z.infer<typeof DistributorInputSchema>;

const DistributorOutputSchema = z.array(DistributionRecordSchema);

export class DistributorAgent extends BaseAgent<
  DistributorInput,
  DistributionRecord[]
> {
  readonly name: AgentName = "distributor";
  readonly inputSchema = DistributorInputSchema;
  readonly outputSchema = DistributorOutputSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: DistributorInput,
  ): Promise<DistributionRecord[]> {
    throw new Error("DistributorAgent.execute() not implemented");
  }
}
