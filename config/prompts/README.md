# Prompt Templates

Each `.md` file in this directory is a prompt template for one of the
10 pipeline agents (Supervisor, Radar, Strategist, Writer, Localizer,
Validator, QualityGate, Distributor, Amplifier, Analyst). Agents that
do not call an LLM (Radar, Analyst, Distributor) still have templates
here as documentation even when the runtime does not interpolate them.

## Template Convention

Templates use `{{variable}}` placeholders that agent code interpolates at runtime:

- `{{agentName}}` — Name of the agent
- `{{runId}}` — Current run identifier
- `{{editionId}}` — Current edition identifier
- `{{currentDate}}` — ISO date string
- `{{input}}` — JSON-serialized agent input payload

Agent-specific variables are documented in each template file.

## Version Control

These templates are version-controlled so that prompt changes are tracked,
diffable, and auditable alongside the code that uses them.
