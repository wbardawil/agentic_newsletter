import { notFound } from "next/navigation";
import { z } from "zod";

import { fetchDraftFile, GitHubError } from "@/lib/github";
import { DraftEditor } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit draft — Admin" };

const EditionParam = z.string().regex(/^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/);

function repoConfig() {
  const repo = process.env.GITHUB_REPO ?? "wbardawil/agentic_newsletter";
  const prefix = process.env.GITHUB_DRAFT_BRANCH_PREFIX ?? "drafts/";
  const branchPrefix = prefix.replace(/\/+$/, "");
  return { repo, branchPrefix };
}

export default async function EditDraftPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  if (!EditionParam.safeParse(edition).success) notFound();

  const { repo, branchPrefix } = repoConfig();
  const branch = `${branchPrefix}/${edition}`;
  const enPath = `drafts/${edition}-en.md`;
  const esPath = `drafts/${edition}-es.md`;

  let en: Awaited<ReturnType<typeof fetchDraftFile>> | null = null;
  let es: Awaited<ReturnType<typeof fetchDraftFile>> | null = null;
  let loadError: string | null = null;

  try {
    [en, es] = await Promise.all([
      fetchDraftFile(repo, branch, enPath),
      fetchDraftFile(repo, branch, esPath),
    ]);
  } catch (err) {
    if (err instanceof GitHubError) {
      loadError =
        err.code === "NOT_FOUND"
          ? `No draft files found on branch ${branch}. The weekly cron may not have produced this edition yet.`
          : err.code === "AUTH"
            ? "Editor not configured: GITHUB_TOKEN missing or invalid. Contact ops."
            : `GitHub error: ${err.message}`;
    } else {
      loadError = "Unexpected error contacting GitHub.";
    }
  }

  const branchUrl = `https://github.com/${repo}/tree/${branch}`;

  return (
    <section className="container-wide py-12">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wide text-[var(--color-fg-muted)]">
          Admin · Draft editor
        </p>
        <h1 className="text-3xl">Edition {edition}</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Branch <code>{branch}</code> ·{" "}
          <a href={branchUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open on GitHub →
          </a>
        </p>
      </header>

      {loadError ? (
        <p className="text-sm text-red-700 border border-red-300 bg-red-50 p-4 rounded">
          {loadError}
        </p>
      ) : en && es ? (
        <DraftEditor
          editionId={edition}
          branch={branch}
          en={{ content: en.content, sha: en.sha, path: en.path }}
          es={{ content: es.content, sha: es.sha, path: es.path }}
        />
      ) : null}
    </section>
  );
}
