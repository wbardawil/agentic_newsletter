import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { Language } from "../types/enums.js";
import {
  LocalizedContentSchema,
  type LocalizedContent,
} from "../types/edition.js";

const LocalizerInputSchema = z.object({
  content: LocalizedContentSchema,
  targetLanguage: Language,
});
type LocalizerInput = z.infer<typeof LocalizerInputSchema>;

export class LocalizerAgent extends BaseAgent<LocalizerInput, LocalizedContent> {
  readonly name: AgentName = "localizer";
  readonly inputSchema = LocalizerInputSchema;
  readonly outputSchema = LocalizedContentSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    _payload: LocalizerInput,
  ): Promise<LocalizedContent> {
    throw new Error("LocalizerAgent.execute() not implemented");
  }
}
