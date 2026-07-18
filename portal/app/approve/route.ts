/**
 * Email approval gate — portal receiver.
 *
 * GET /approve?t=<signed-token>
 *
 * Replaces the Cloudflare Worker (`workers/approval-receiver`) as the magic-link
 * target. The signed token IS the authorization — no session is required, since
 * the editor taps this from the digest email on a phone. We verify the HMAC
 * signature + expiry, then publish the edition directly to Supabase.
 *
 * Configure APPROVAL_SIGNING_SECRET (same value the digest signer uses) in the
 * portal env. Point the GitHub Actions secret APPROVAL_BASE_URL at this origin
 * (+ basePath) so the digest builds `<portal>/approve?t=…`.
 */

import { verifyApprovalToken } from "@/lib/approval-token";
import { publishEdition, PublishError } from "@/lib/publish-edition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(status: number, title: string, message: string, detail?: string): Response {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
.detail { margin-top:16px; padding:12px; background:#F4EFE6; border-radius:6px; font-family:ui-monospace,monospace; font-size:12px; color:#7A7466; word-break:break-word; }
</style>
</head>
<body>
<div class="box">
<h1>${esc(title)}</h1>
<p>${esc(message)}</p>
${detail ? `<div class="detail">${esc(detail)}</div>` : ""}
</div>
</body>
</html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.APPROVAL_SIGNING_SECRET;
  if (!secret) {
    return page(
      500,
      "Approval not configured",
      "APPROVAL_SIGNING_SECRET is not set on the portal. The link could not be verified.",
    );
  }

  const token = new URL(request.url).searchParams.get("t");
  if (!token) {
    return page(
      400,
      "Missing token",
      "The approval link is incomplete. Re-open the digest email and tap the button again.",
    );
  }

  const payload = verifyApprovalToken(token, secret);
  if (!payload) {
    return page(
      401,
      "Invalid or expired link",
      "This approval link cannot be verified. It may have expired (links last 7 days), or the signing secret may have rotated.",
    );
  }

  try {
    const result = await publishEdition(payload.editionId);
    return page(
      200,
      `Edition ${result.editionId} published`,
      `The edition is now live in the portal (QA ${result.qaScore}/100, ${result.sourcesMirrored} source(s) synced). It appears in the archive and the public newsroom. You can close this tab.`,
    );
  } catch (err) {
    if (err instanceof PublishError) {
      if (err.code === "QUALITY_GATE") {
        return page(422, "Quality gate not met", "This edition did not pass the automated quality checks, so it was not published.", err.message);
      }
      if (err.code === "NOT_FOUND") {
        return page(404, "Draft not found", "No draft was found for this edition. It may not have been generated yet.", err.message);
      }
      if (err.code === "CONFIG") {
        return page(500, "Portal not configured", "The portal is missing required configuration to publish.", err.message);
      }
      if (err.code === "INVALID_DRAFT") {
        return page(422, "Draft is incomplete", "The draft could not be published as-is.", err.message);
      }
      // GITHUB / DB / UNKNOWN
      return page(502, "Publish failed", "The link verified, but publishing the edition failed. Try again, or publish manually via Actions → Publish to Beehiiv.", err.message);
    }
    return page(500, "Unexpected error", "Something went wrong while publishing this edition.", err instanceof Error ? err.message : String(err));
  }
}
