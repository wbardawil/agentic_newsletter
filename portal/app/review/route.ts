/**
 * Editorial review gate — portal receiver for granular decisions.
 *
 * GET /review?t=<signed-review-token>
 *
 * Handles the five review decisions:
 *   image_approve   → marks image approved; waiting for content.
 *   image_reject    → marks image for regeneration; triggers regenerate-image.yml.
 *   content_approve → if image approved, marks content approved and publishes to Supabase.
 *   content_reject  → resets both statuses; triggers full weekly-draft.yml rerun.
 *   section_reject  → records section feedback; triggers weekly-draft.yml rerun.
 *
 * Configure APPROVAL_SIGNING_SECRET (same value the digest signer uses) in the
 * portal env. Point APPROVAL_BASE_URL at this origin so the digest builds
 * `<portal>/review?t=…`.
 */

import { verifyReviewToken } from "@/lib/approval-token";
import {
  loadReview,
  saveReview,
  saveRejectionFeedback,
  applyDecision,
  ReviewStateError,
} from "@/lib/review-state";
import { publishEdition, PublishError } from "@/lib/publish-edition";
import { dispatchWorkflow, GitHubError } from "@/lib/github";
import { sendPublicationConfirmation } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── HTML response helper ──────────────────────────────────────────────────────

function page(
  status: number,
  title: string,
  message: string,
  detail?: string,
  extra?: string,
): Response {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body { margin:0; padding:24px 16px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; background:#F4EFE6; color:#0F1A2B; }
.box { max-width:480px; margin:64px auto; padding:32px; background:#FFF; border-radius:12px; box-shadow:0 1px 3px rgba(15,26,43,0.06); }
h1 { font-family:"Cormorant Garamond",Garamond,serif; font-size:24px; margin:0 0 8px 0; }
p { font-size:15px; line-height:1.6; color:#1F4E5F; margin:12px 0 0 0; }
.extra { margin-top:12px; font-size:14px; color:#0F1A2B; }
.detail { margin-top:16px; padding:12px; background:#F4EFE6; border-radius:6px; font-family:ui-monospace,monospace; font-size:12px; color:#7A7466; word-break:break-word; }
</style>
</head>
<body>
<div class="box">
<h1>${esc(title)}</h1>
<p>${esc(message)}</p>
${extra ? `<p class="extra">${esc(extra)}</p>` : ""}
${detail ? `<div class="detail">${esc(detail)}</div>` : ""}
</div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ── Config helpers ────────────────────────────────────────────────────────────

function githubRepo(): string {
  return process.env.GITHUB_REPO ?? "wbardawil/agentic_newsletter";
}

function mainBranch(): string {
  return process.env.GITHUB_MAIN_BRANCH ?? "main";
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  // ── 1. check APPROVAL_SIGNING_SECRET ──
  const secret = process.env.APPROVAL_SIGNING_SECRET;
  if (!secret) {
    return page(
      500,
      "Review gate not configured",
      "APPROVAL_SIGNING_SECRET is not set on the portal. The link could not be verified.",
    );
  }

  // ── 2. verify token ──
  const token = new URL(request.url).searchParams.get("t");
  if (!token) {
    return page(
      400,
      "Missing token",
      "The review link is incomplete. Re-open the digest email and tap the button again.",
    );
  }

  const payload = verifyReviewToken(token, secret);
  if (!payload) {
    return page(
      401,
      "Invalid or expired link",
      "This review link cannot be verified. It may have expired (links last 7 days), or the signing secret may have rotated.",
    );
  }

  const { editionId, decision, sectionType } = payload;

  // ── 3. load review.json ──
  let loaded;
  try {
    loaded = await loadReview(editionId);
  } catch (err) {
    return page(
      502,
      "Could not load review state",
      `Failed to read review.json for edition ${editionId}.`,
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!loaded) {
    return page(
      404,
      "Review state not found",
      `No review state found for edition ${editionId}. The draft may not have been generated yet, or the pipeline did not create a review.json.`,
    );
  }

  // ── 4. apply decision ──
  let updated;
  try {
    updated = applyDecision(loaded.state, decision, { sectionType });
  } catch (err) {
    if (err instanceof ReviewStateError && err.code === "IMAGE_REQUIRED") {
      return page(
        422,
        "Image approval required first",
        err.message,
        `Image status: ${loaded.state.image.status}`,
      );
    }
    if (err instanceof ReviewStateError) {
      return page(422, "Invalid action", err.message);
    }
    return page(500, "Unexpected error", "Failed to apply the review decision.", err instanceof Error ? err.message : String(err));
  }

  // ── 5. save review.json back to GitHub ──
  try {
    await saveReview(editionId, updated);
  } catch (err) {
    return page(
      502,
      "Could not save review state",
      "The decision was processed but could not be persisted to GitHub.",
      err instanceof Error ? err.message : String(err),
    );
  }

  // ── 6. side effects per decision ──
  const repo = githubRepo();
  const ref = mainBranch();

  if (decision === "image_approve") {
    return page(
      200,
      "Imagen aprobada ✓",
      `La imagen de la edición ${editionId} está aprobada. Ahora puedes aprobar el artículo desde el correo.`,
      undefined,
      "Próximo paso: aprueba el artículo para publicar.",
    );
  }

  if (decision === "image_reject") {
    // Trigger regenerate-image.yml (non-blocking: workflow may not exist yet)
    try {
      await dispatchWorkflow(repo, "regenerate-image.yml", ref, {
        edition: editionId,
        attempt: String(updated.image.attempt + 1),
        feedback: payload.sectionType ?? "",
      });
    } catch (err) {
      // Non-fatal: log but don't fail the response. The editor still sees a
      // useful page; they can re-trigger manually if needed.
      console.warn(
        `[review] regenerate-image.yml dispatch failed for ${editionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return page(
        200,
        "Imagen rechazada — regeneración pendiente",
        `El rechazo de imagen para la edición ${editionId} fue registrado. La regeneración automática no pudo iniciarse${err instanceof GitHubError && err.code === "NOT_FOUND" ? " (el workflow regenerate-image.yml no existe aún)" : ""}.`,
        "Puedes disparar la regeneración manualmente desde GitHub Actions.",
      );
    }
    return page(
      200,
      "Imagen rechazada — regenerando",
      `Una nueva imagen se está generando para la edición ${editionId}. Recibirás un nuevo correo de revisión cuando esté lista.`,
    );
  }

  if (decision === "content_approve") {
    // Publish to Supabase newsroom.
    // publishEdition reads review.json internally and gets heroImageUrl from there.
    try {
      const result = await publishEdition(editionId);
      sendPublicationConfirmation({
        editionId: result.editionId,
        qaScore: result.qaScore,
        sourcesMirrored: result.sourcesMirrored,
        heroImageUrl: result.heroImageUrl,
      }).catch((e) => console.error("[review] publication confirmation email failed:", e));
      return page(
        200,
        `Edición ${result.editionId} publicada ✓`,
        `La edición está disponible en el newsroom (QA ${result.qaScore}/100, ${result.sourcesMirrored} fuente(s) sincronizadas). Puedes cerrar esta pestaña.`,
        result.heroImageUrl ? `Hero image: ${result.heroImageUrl}` : undefined,
      );
    } catch (err) {
      if (err instanceof PublishError) {
        if (err.code === "QUALITY_GATE") {
          return page(422, "Quality gate no superado", "La edición no pasó las verificaciones de calidad y no fue publicada.", err.message);
        }
        if (err.code === "NOT_FOUND") {
          return page(404, "Draft no encontrado", "No se encontró el draft para esta edición.", err.message);
        }
        if (err.code === "CONFIG") {
          return page(500, "Portal no configurado", "Falta configuración requerida para publicar.", err.message);
        }
        return page(502, "Publicación fallida", "El enlace se verificó pero la publicación falló. Intenta de nuevo o publica manualmente.", err.message);
      }
      return page(500, "Error inesperado", "Algo salió mal al publicar.", err instanceof Error ? err.message : String(err));
    }
  }

  if (decision === "content_reject" || decision === "section_reject") {
    // Write rejection.json for pipeline feedback
    try {
      await saveRejectionFeedback(
        editionId,
        decision,
        undefined,
        decision === "section_reject" && sectionType
          ? [{ sectionType }]
          : undefined,
      );
    } catch (err) {
      console.warn(`[review] rejection.json write failed for ${editionId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Trigger full weekly-draft.yml rerun
    try {
      await dispatchWorkflow(repo, "weekly-draft.yml", ref, {
        edition: editionId,
      });
    } catch (err) {
      console.warn(`[review] weekly-draft.yml dispatch failed for ${editionId}: ${err instanceof Error ? err.message : String(err)}`);
      const label =
        decision === "section_reject"
          ? `Sección ${sectionType ?? ""} rechazada — regeneración pendiente`
          : "Artículo rechazado — regeneración pendiente";
      return page(
        200,
        label,
        `El rechazo fue registrado para la edición ${editionId}. El rerun automático no pudo iniciarse.`,
        "Puedes disparar el workflow weekly-draft.yml manualmente desde GitHub Actions.",
      );
    }

    const label =
      decision === "section_reject"
        ? `Sección rechazada — generando nuevo draft`
        : "Artículo rechazado — generando nuevo draft";
    const detail =
      decision === "section_reject"
        ? `La sección "${sectionType}" fue rechazada para la edición ${editionId}. Se generará un nuevo draft completo (imagen + artículo) y recibirás un nuevo correo de revisión.`
        : `El artículo de la edición ${editionId} fue rechazado. Se generará un nuevo draft completo y recibirás un nuevo correo de revisión.`;

    return page(200, label, detail);
  }

  // Should never reach here (TypeScript exhaustive)
  return page(500, "Unknown decision", `Unhandled decision: ${decision}`);
}
