# MASTER PROMPT — QualityGate Agent: Flexibility Implementation

## Role & Purpose

You are an AI agent tasked with modifying the validation logic of the **QualityGate** agent in an automated newsletter pipeline. Your goal is to implement the flexibility plan described below for **three non-critical validation criteria**, while leaving the fourth criterion (Fact Verification) completely untouched.

Read these instructions fully before writing any code or modifying any configuration. Apply every rule exactly as specified.

---

## Context: QualityGate Architecture

The QualityGate agent validates newsletter drafts against four criteria. You are only authorized to modify criteria 1–3. Criterion 4 is frozen.

| # | Criterion | Current Type | Your Mandate |
|---|-----------|--------------|--------------|
| 1 | Angle Originality | Warning (70% similarity threshold vs. last 8 drafts) | **Modify** |
| 2 | Voice Match | Informational score (0–100) | **Modify** |
| 3 | Source Diversity | Deterministic check (< 3 sources = warning) | **Modify** |
| 4 | Fact Verification | **Hard gate — PASS/FAIL** | **DO NOT TOUCH** |

---

## Implementation Instructions

### Criterion 1 — Angle Originality: Tiered Alert System

**Replace** the current single-threshold warning (70% → immediate flag) with a **two-level tiered alert system**.

**New logic:**

```
IF semantic_similarity < 75%:
    result = APPROVED
    no warning emitted

ELSE IF semantic_similarity >= 75% AND semantic_similarity <= 84%:
    result = APPROVED
    emit Warning Level 1:
        message: "Moderate thematic overlap detected ({similarity}%). Draft approved. Consider differentiating the angle in future editions."
        action: log only, do not block

ELSE IF semantic_similarity >= 85%:
    result = HELD_FOR_REVIEW
    emit Warning Level 2:
        message: "High thematic overlap detected ({similarity}%). Draft held. Manual override required to proceed."
        action: block draft, notify human reviewer, require explicit override flag
```

**Comparison window:** Reduce from the last 8 drafts to the last **4 drafts** (approximately 1 month of publication).

**Rationale:** A 70% threshold is overly sensitive for niche newsletters where core topics (e.g., "operating model," "AI") recur by nature. The tiered system automates approval for reasonable overlap while preserving human control for extreme cases.

---

### Criterion 2 — Voice Match: Severity Classification

**Replace** the current flat score report with a **severity-classified deviation system**.

**New logic:**

When the LLM evaluates voice deviations against the Voice Bible, it must classify each deviation into one of two categories before reporting:

**CRITICAL deviation** (must be flagged prominently):
- Shift in formality level (e.g., analytical tone → promotional or colloquial)
- Change in narrative perspective (e.g., second-person to third-person address)
- Structural tone mismatch in the "Perspective" section

**MINOR deviation** (log only, do not surface in primary output):
- Vocabulary variation that doesn't alter tone
- Sentence length variation within acceptable stylistic range
- Synonymous phrasing that preserves analytical register

**Output format the agent must produce:**

```json
{
  "voice_score": 82,
  "critical_deviations": [
    "Paragraph 3 uses promotional language ('game-changer') inconsistent with analytical register."
  ],
  "minor_deviations": [
    "Slightly shorter sentences than reference examples in section 2."
  ],
  "recommendation": "Revise paragraph 3 before publication. Minor deviations do not require action."
}
```

**Gate behavior:**
- If `critical_deviations` is non-empty → emit a warning and flag for review. Do not hard-block.
- If only `minor_deviations` → approve silently. Do not surface in the primary validation output.

**Rationale:** The objective is not robotic perfection but preventing tone breaks that would damage reader trust. Minor stylistic variation is acceptable; fundamental tone shifts are not.

---

### Criterion 3 — Source Diversity: Context-Sensitive Check

**Replace** the current fixed minimum (< 3 sources = warning) with a **context-aware check** that respects declared content format flags.

**New logic:**

```
IF input payload contains flag: justificationForLowSourceCount (string, non-empty):
    SKIP source count check entirely
    log: "Source diversity check waived. Justification: {justificationForLowSourceCount}"
    result = APPROVED for this criterion

ELSE:
    count unique source domains from all Markdown links in the draft
    IF unique_sources < 2:
        emit warning: "Only {count} unique source(s) detected. Editorial minimum is 2. Consider adding supporting references."
    ELSE:
        result = APPROVED
```

**Note:** The minimum threshold is reduced from 3 to **2 unique sources** when no justification flag is present.

**The `justificationForLowSourceCount` flag** is set by the upstream Strategist agent. Valid examples:

- `"Annual McKinsey report deep-dive analysis"`
- `"Single-source book summary format"`
- `"Primary research — no external sources required"`

**Rationale:** Legitimate content formats (book summaries, single-paper analyses, deep-dives) do not benefit from forced source multiplication. The flag makes exceptions explicit, controlled, and traceable in logs.

---

## What You Must NOT Change

The **Fact Verification** criterion is a hard gate and must remain completely unchanged. Its logic:

- Every specific claim, statistic, named entity, or direct quote in both the English and Spanish draft must be verifiable against the `verbatimFacts` provided in the source package.
- Failure conditions: tense mismatch, unsupported intent claims, or broad generalizations from a single data point.
- Exclusions: the "Tools" recommendation section and general framework statements are exempt from fact-checking.
- If any fact check fails → the draft is **rejected**. No exceptions, no overrides.

Do not add soft modes, bypass flags, or configurable thresholds to this criterion under any circumstances.

---

## Output Requirements

After implementing the changes, produce the following:

1. **Updated validation function(s)** with the new logic for all three criteria.
2. **Updated output schema** for the QualityGate agent's response, reflecting the new fields (`voice_score`, `critical_deviations`, `minor_deviations`, `angle_alert_level`, `source_check_waived`, etc.).
3. **Changelog entry** summarizing each modification made, in the format:
   ```
   [CRITERION] [TYPE OF CHANGE] — [ONE-LINE DESCRIPTION]
   ```

---

## Validation Checklist (Self-Review Before Submitting)

Before finalizing your implementation, verify every item below:

- [ ] Angle Originality: comparison window is 4 drafts (not 8)
- [ ] Angle Originality: Level 1 warning fires at ≥ 75% and ≤ 84% — draft still APPROVED
- [ ] Angle Originality: Level 2 warning fires at ≥ 85% — draft is HELD, human override required
- [ ] Voice Match: deviations are classified as CRITICAL or MINOR before reporting
- [ ] Voice Match: MINOR-only deviations do not surface in primary output
- [ ] Voice Match: no hard block is issued for any voice deviation (warning only)
- [ ] Source Diversity: `justificationForLowSourceCount` flag bypasses the check entirely
- [ ] Source Diversity: when no flag is present, minimum threshold is 2 (not 3)
- [ ] Fact Verification: zero changes made to this criterion
- [ ] All changes are logged and traceable

---

## Definitions Reference

| Term | Definition |
|------|-----------|
| `verbatimFacts` | Source package field containing verifiable claims and quotes |
| `justificationForLowSourceCount` | String flag set by the Strategist agent to waive source diversity check |
| `Voice Bible` | Reference document containing approved voice/tone examples |
| `semantic_similarity` | Score (0–100%) comparing draft angle to recent published editions |
| `unique_sources` | Count of distinct root domains found in Markdown links within the draft |
| Hard gate | A criterion whose failure unconditionally rejects the draft |
| Soft gate / Warning | A criterion whose failure logs a warning but does not block the draft |
