import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { Language } from "../types/enums.js";
import { SourceItemSchema, type SourceItem } from "../types/source-bundle.js";
import {
  StrategicAngleSchema,
  LocalizedContentSchema,
  type LocalizedContent,
} from "../types/edition.js";

const WriterInputSchema = z.object({
  angle: StrategicAngleSchema,
  sources: z.array(SourceItemSchema),
  language: Language,
});
type WriterInput = z.infer<typeof WriterInputSchema>;

export class WriterAgent extends BaseAgent<WriterInput, LocalizedContent> {
  readonly name: AgentName = "writer";
  readonly inputSchema = WriterInputSchema;
  readonly outputSchema = LocalizedContentSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(_payload: WriterInput): Promise<LocalizedContent> {
    throw new Error("WriterAgent.execute() not implemented");
  }
}
