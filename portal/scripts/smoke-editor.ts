/**
 * Smoke test for the portal/lib/github.ts helper.
 *
 * Validates the GitHub Contents API roundtrip the admin editor relies on,
 * WITHOUT needing Supabase auth or the portal dev server running.
 *
 * What it does:
 *   1. Reads drafts/<edition>-en.md and drafts/<edition>-es.md from the
 *      drafts/<edition> branch.
 *   2. Appends a timestamped comment to the EN body and commits it back.
 *   3. Prints the commit URL.
 *   4. Reverts the EN body to its original content with a second commit
 *      (so the branch stays clean for re-runs).
 *
 * Required env vars:
 *   GITHUB_TOKEN — fine-grained PAT with Contents: read/write on the repo
 *
 * Optional env vars:
 *   GITHUB_REPO    — default "wbardawil/agentic_newsletter"
 *   SMOKE_EDITION  — default "2026-21". Must exist as branch drafts/<id>.
 *
 * Run from repo root:
 *   $env:GITHUB_TOKEN = "github_pat_..."
 *   node --import tsx portal/scripts/smoke-editor.ts
 */

import { fetchDraftFile, commitDraftFile, GitHubError } from "../lib/github";

const REPO = process.env.GITHUB_REPO ?? "wbardawil/agentic_newsletter";
const EDITION = process.env.SMOKE_EDITION ?? "2026-21";
const BRANCH = `drafts/${EDITION}`;
const EN_PATH = `drafts/${EDITION}-en.md`;
const ES_PATH = `drafts/${EDITION}-es.md`;

function bullet(label: string, ok: boolean, detail = ""): void {
  const mark = ok ? "✓" : "✗";
  console.log(`  ${mark} ${label}${detail ? " — " + detail : ""}`);
}

async function main(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    console.error("❌ GITHUB_TOKEN not set. Aborting.");
    console.error("   In PowerShell:  $env:GITHUB_TOKEN = 'github_pat_...'");
    process.exit(1);
  }

  console.log(`\n🧪 Smoke test — portal/lib/github.ts`);
  console.log(`   Repo:    ${REPO}`);
  console.log(`   Branch:  ${BRANCH}`);
  console.log(`   Edition: ${EDITION}\n`);

  // ── Step 1: read both files ────────────────────────────────────────────────
  console.log("📥 Step 1/4 — fetchDraftFile (EN + ES)");
  let en: Awaited<ReturnType<typeof fetchDraftFile>>;
  let es: Awaited<ReturnType<typeof fetchDraftFile>>;
  try {
    [en, es] = await Promise.all([
      fetchDraftFile(REPO, BRANCH, EN_PATH),
      fetchDraftFile(REPO, BRANCH, ES_PATH),
    ]);
  } catch (err) {
    if (err instanceof GitHubError) {
      bullet(`fetchDraftFile failed — ${err.code}`, false, err.message);
      if (err.code === "NOT_FOUND") {
        console.error(
          `\n   The branch ${BRANCH} or one of the .md files does not exist on the remote.`,
        );
        console.error(`   Push it first:`);
        console.error(`     git checkout -b ${BRANCH}`);
        console.error(`     git add drafts/${EDITION}-en.md drafts/${EDITION}-es.md drafts/${EDITION}-draft.json`);
        console.error(`     git commit -m "test: seed ${BRANCH} for editor smoke"`);
        console.error(`     git push -u origin ${BRANCH}`);
        console.error(`     git checkout main`);
      }
      process.exit(1);
    }
    throw err;
  }
  bullet(`Read EN`, true, `SHA ${en.sha.slice(0, 7)}, ${en.size} bytes`);
  bullet(`Read ES`, true, `SHA ${es.sha.slice(0, 7)}, ${es.size} bytes`);
  bullet(`Base64 decode produced UTF-8`, en.content.includes("# The Transformation Letter"));

  const originalEnContent = en.content;
  const timestamp = new Date().toISOString();
  const editedEnContent =
    originalEnContent.replace(/\s*$/, "") +
    `\n\n<!-- smoke-edit at ${timestamp} -->\n`;

  // ── Step 2: write modification ─────────────────────────────────────────────
  console.log("\n📤 Step 2/4 — commitDraftFile (EN, with edit)");
  let firstCommit: Awaited<ReturnType<typeof commitDraftFile>>;
  try {
    firstCommit = await commitDraftFile(
      REPO,
      BRANCH,
      EN_PATH,
      editedEnContent,
      en.sha,
      `edit(${EDITION}-en): smoke test at ${timestamp}`,
    );
  } catch (err) {
    if (err instanceof GitHubError) {
      bullet(`commit failed — ${err.code}`, false, err.message);
      process.exit(1);
    }
    throw err;
  }
  bullet(`Commit succeeded`, true, `new SHA ${firstCommit.newSha.slice(0, 7)}`);
  bullet(`Commit URL returned`, !!firstCommit.commitUrl, firstCommit.commitUrl);
  bullet(
    `New SHA differs from original`,
    firstCommit.newSha !== en.sha,
    `${en.sha.slice(0, 7)} → ${firstCommit.newSha.slice(0, 7)}`,
  );

  // ── Step 3: verify SHA conflict handling ───────────────────────────────────
  console.log("\n⚠️  Step 3/4 — SHA conflict drill (write with stale sha)");
  try {
    await commitDraftFile(
      REPO,
      BRANCH,
      EN_PATH,
      editedEnContent + "\n<!-- second edit -->\n",
      en.sha, // OLD sha — should conflict against newly-committed remote
      "edit: should fail with stale sha",
    );
    bullet(`Expected SHA_CONFLICT but commit succeeded`, false, "leak — investigate");
    process.exit(1);
  } catch (err) {
    if (err instanceof GitHubError && err.code === "SHA_CONFLICT") {
      bullet(
        `SHA_CONFLICT raised correctly`,
        true,
        `remote SHA returned: ${err.remoteSha?.slice(0, 7) ?? "missing"}`,
      );
    } else {
      bullet(`Unexpected error`, false, String(err));
      process.exit(1);
    }
  }

  // ── Step 4: revert ─────────────────────────────────────────────────────────
  console.log("\n♻️  Step 4/4 — revert EN to original");
  const secondCommit = await commitDraftFile(
    REPO,
    BRANCH,
    EN_PATH,
    originalEnContent,
    firstCommit.newSha,
    `revert(${EDITION}-en): smoke test cleanup`,
  );
  bullet(`Reverted`, true, `final SHA ${secondCommit.newSha.slice(0, 7)}`);

  console.log("\n✅ All checks passed.");
  console.log(`\n   View commits on the branch:`);
  console.log(`   https://github.com/${REPO}/commits/${BRANCH}\n`);
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:");
  console.error(err);
  process.exit(1);
});
