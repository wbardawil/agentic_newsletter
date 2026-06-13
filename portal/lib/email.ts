/**
 * Thin Resend wrapper — server-only.
 *
 * Uses the Resend REST API directly (no SDK) to keep the portal's dependency
 * footprint minimal. All functions are fire-and-log: email failures are never
 * fatal to the core operation (application save / approval update).
 *
 * Required env vars:
 *   RESEND_API_KEY   — Resend API key (re:...)
 *   RESEND_FROM      — Verified sender address (e.g. "Wadi <wadi@transformationletter.com>")
 *   PORTAL_BASE_URL  — Public portal URL for magic-link CTAs (e.g. https://app.transformationletter.com)
 */

if (typeof window !== "undefined") {
  throw new Error("portal/lib/email.ts is server-only.");
}

const RESEND_API = "https://api.resend.com/emails";

function resendKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "The Transformation Letter <no-reply@transformationletter.com>";
}

function portalUrl(): string {
  return (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
}

async function send(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = resendKey();
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", payload.to);
    return;
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    console.error(`[email] Resend error ${res.status} for ${payload.to}: ${body}`);
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Sent immediately after a new application is saved to Supabase. */
export async function sendApplicationConfirmation(to: string, name: string): Promise<void> {
  await send({
    to,
    subject: "We received your application — The Transformation Letter",
    html: `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#0F1A2B;line-height:1.6">
  <p>Hi ${escHtml(name)},</p>
  <p>We received your application to <strong>The Transformation Letter</strong>. Thank you for taking the time.</p>
  <p>We review each application personally. You'll hear back from us within a few business days — one way or another.</p>
  <p style="margin-top:32px">— Wadi</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0">
  <p style="font-size:12px;color:#6B7280">The Transformation Letter · Diagnostics for $5–100M owner-operators</p>
</div>`,
  });
}

/**
 * Sent when an admin marks an application as approved.
 * Points the applicant to /sign-in so they can claim their magic link.
 */
export async function sendApprovalNotification(to: string, name: string): Promise<void> {
  const signInUrl = `${portalUrl()}/sign-in`;
  await send({
    to,
    subject: "You're in — The Transformation Letter",
    html: `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#0F1A2B;line-height:1.6">
  <p>Hi ${escHtml(name)},</p>
  <p>Your application to <strong>The Transformation Letter</strong> has been approved.</p>
  <p>To access the full bilingual archive and the Transformation AI assistant, sign in with your email:</p>
  <p style="margin:24px 0">
    <a href="${signInUrl}" style="background:#C7892A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:sans-serif;font-size:15px">
      Access the archive →
    </a>
  </p>
  <p>Just enter the email address you used on your application — we'll send you a magic link.</p>
  <p style="margin-top:32px">— Wadi</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0">
  <p style="font-size:12px;color:#6B7280">The Transformation Letter · Diagnostics for $5–100M owner-operators</p>
</div>`,
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
