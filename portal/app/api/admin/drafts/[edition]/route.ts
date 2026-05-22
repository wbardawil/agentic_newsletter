import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchDraftFile,
  commitDraftFile,
  GitHubError,
} from "@/lib/github";

export const dynamic = "force-dynamic";

const EditionParam = z.string().regex(/^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/);

const PutBody = z.object({
  language: z.enum(["en", "es"]),
  content: z.string().min(1).max(200_000),
  sha: z.string().regex(/^[0-9a-f]{40}$/i),
  message: z.string().min(1).max(200).optional(),
});

function repoConfig() {
  const repo = process.env.GITHUB_REPO ?? "wbardawil/agentic_newsletter";
  const prefix = process.env.GITHUB_DRAFT_BRANCH_PREFIX ?? "drafts/";
  return { repo, prefix };
}

function branchFor(prefix: string, editionId: string): string {
  return `${prefix.replace(/\/+$/, "")}/${editionId}`;
}

function pathFor(editionId: string, language: "en" | "es"): string {
  return `drafts/${editionId}-${language}.md`;
}

async function requireAdmin(): Promise<{ ok: true; email: string } | { ok: false; response: NextResponse }> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = (user.email ?? "").toLowerCase();
  if (!adminEmails.includes(email)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, email };
}

function mapGitHubError(err: unknown): NextResponse {
  if (err instanceof GitHubError) {
    if (err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Draft file or branch not found.", code: err.code }, { status: 404 });
    }
    if (err.code === "SHA_CONFLICT") {
      return NextResponse.json(
        { error: "Branch moved; reload and re-apply.", code: err.code, remoteSha: err.remoteSha ?? null },
        { status: 409 },
      );
    }
    if (err.code === "AUTH") {
      return NextResponse.json({ error: "Editor not configured: GitHub auth failed.", code: err.code }, { status: 500 });
    }
    if (err.code === "VALIDATION") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
  }
  return NextResponse.json({ error: "Unexpected error contacting GitHub." }, { status: 502 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ edition: string }> },
): Promise<NextResponse> {
  const { edition } = await params;
  const editionParse = EditionParam.safeParse(edition);
  if (!editionParse.success) {
    return NextResponse.json({ error: "Invalid edition ID. Expected YYYY-WW." }, { status: 422 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { repo, prefix } = repoConfig();
  const branch = branchFor(prefix, edition);

  try {
    const [en, es] = await Promise.all([
      fetchDraftFile(repo, branch, pathFor(edition, "en")),
      fetchDraftFile(repo, branch, pathFor(edition, "es")),
    ]);
    return NextResponse.json({
      editionId: edition,
      branch,
      branchUrl: `https://github.com/${repo}/tree/${branch}`,
      en: { content: en.content, sha: en.sha, path: en.path },
      es: { content: es.content, sha: es.sha, path: es.path },
    });
  } catch (err) {
    return mapGitHubError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ edition: string }> },
): Promise<NextResponse> {
  const { edition } = await params;
  const editionParse = EditionParam.safeParse(edition);
  if (!editionParse.success) {
    return NextResponse.json({ error: "Invalid edition ID. Expected YYYY-WW." }, { status: 422 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = PutBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 422 });
  }

  const { repo, prefix } = repoConfig();
  const branch = branchFor(prefix, edition);
  const path = pathFor(edition, parsed.data.language);
  const message =
    parsed.data.message?.trim() ||
    `edit(${edition}-${parsed.data.language}): web editor update by ${auth.email}`;

  try {
    const result = await commitDraftFile(
      repo,
      branch,
      path,
      parsed.data.content,
      parsed.data.sha,
      message,
    );
    return NextResponse.json({
      ok: true,
      language: parsed.data.language,
      newSha: result.newSha,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
    });
  } catch (err) {
    return mapGitHubError(err);
  }
}
