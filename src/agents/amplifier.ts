import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import {
  EditionSchema,
  DistributionRecordSchema,
} from "../types/edition.js";

const AmplifierInputSchema = z.object({
  edition: EditionSchema,
  distribution: z.array(DistributionRecordSchema),
});
type AmplifierInput = z.infer<typeof AmplifierInputSchema>;

const SocialPostSchema = z.object({
  platform: z.enum(["linkedin", "twitter"]),
  content: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

const AmplifierOutputSchema = z.object({
  posts: z.array(SocialPostSchema),
});
type AmplifierOutput = z.infer<typeof AmplifierOutputSchema>;

export class AmplifierAgent extends BaseAgent<
  AmplifierInput,
  AmplifierOutput
> {
  readonly name: AgentName = "amplifier";
  readonly inputSchema = AmplifierInputSchema;
  readonly outputSchema = AmplifierOutputSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: AmplifierInput,
  ): Promise<AmplifierOutput> {
    throw new Error("AmplifierAgent.execute() not implemented");
  }
}
