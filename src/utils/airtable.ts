/**
 * Minimal Airtable REST client for writing pipeline run summaries.
 *
 * Uses the Airtable Web API v0 (no SDK dependency).
 * Expects two tables to exist in the configured base:
 *   - "Run Ledger"  — one row per pipeline run
 *   - "Agent Steps" — one row per agent invocation within a run
 *
 * All fields are strings / numbers to match default Airtable column types.
 * Missing or unconfigured tables are silently skipped.
 */

const AIRTABLE_BASE_URL = "https://api.airtable.com/v0";

export interface RunSummaryRecord {
  runId: string;
  editionId: string;
  status: string;
  triggeredAt: string;
  completedAt?: string;
  totalCostUsd: number;
  radarCostUsd?: number;
  strategistCostUsd?: number;
  writerCostUsd?: number;
  validatorCostUsd?: number;
  localizerCostUsd?: number;
  distributorCostUsd?: number;
  amplifierCostUsd?: number;
  analystCostUsd?: number;
  notes?: string;
}

export interface AgentStepRecord {
  runId: string;
  editionId: string;
  agentName: string;
  status: string;
  durationMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  timestamp: string;
}

async function upsertRecord(
  apiKey: string,
  baseId: string,
  tableName: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const url = `${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent(tableName)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable write failed (${response.status}): ${text.slice(0, 200)}`);
  }
}

/** Write a run summary row to the "Run Ledger" Airtable table. */
export async function writeRunSummary(
  apiKey: string,
  baseId: string,
  record: RunSummaryRecord,
): Promise<void> {
  await upsertRecord(apiKey, baseId, "Run Ledger", {
    "Run ID": record.runId,
    "Edition ID": record.editionId,
    Status: record.status,
    "Triggered At": record.triggeredAt,
    "Completed At": record.completedAt ?? "",
    "Total Cost (USD)": record.totalCostUsd,
    "Radar Cost": record.radarCostUsd ?? 0,
    "Strategist Cost": record.strategistCostUsd ?? 0,
    "Writer Cost": record.writerCostUsd ?? 0,
    "Validator Cost": record.validatorCostUsd ?? 0,
    "Localizer Cost": record.localizerCostUsd ?? 0,
    "Distributor Cost": record.distributorCostUsd ?? 0,
    "Amplifier Cost": record.amplifierCostUsd ?? 0,
    "Analyst Cost": record.analystCostUsd ?? 0,
    Notes: record.notes ?? "",
  });
}

/** Write an agent step row to the "Agent Steps" Airtable table. */
export async function writeAgentStep(
  apiKey: string,
  baseId: string,
  record: AgentStepRecord,
): Promise<void> {
  await upsertRecord(apiKey, baseId, "Agent Steps", {
    "Run ID": record.runId,
    "Edition ID": record.editionId,
    "Agent Name": record.agentName,
    Status: record.status,
    "Duration (ms)": record.durationMs,
    "Cost (USD)": record.costUsd,
    "Input Tokens": record.inputTokens,
    "Output Tokens": record.outputTokens,
    Error: record.error ?? "",
    Timestamp: record.timestamp,
  });
}
