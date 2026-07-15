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

import nodemailer from "nodemailer";
import { normalizeLang } from "./i18n/dictionary";

const RESEND_API = "https://api.resend.com/emails";

function resendKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "The Transformation Letter <no-reply@transformationletter.com>";
}

function portalUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && portStr && user && pass) {
    // SMTP_TLS_REJECT_UNAUTHORIZED defaults to "false" to handle providers
    // (e.g. Brevo/SendinBlue) whose relay hosts present a self-signed cert
    // in the TLS chain. Set to "true" in production if your SMTP host has a
    // fully trusted certificate chain.
    const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED === "true";
    return {
      host,
      port: parseInt(portStr, 10),
      secure: portStr === "465", // true for 465, false for 587 or other ports
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized,
      },
    };
  }
  return null;
}

async function send(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const smtpConfig = getSmtpConfig();

  if (smtpConfig) {
    try {
      const transporter = nodemailer.createTransport(smtpConfig);
      const from = process.env.SMTP_FROM ?? fromAddress();
      await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      console.log(`[email] Email sent successfully via SMTP to ${payload.to}`);
      return;
    } catch (smtpError) {
      console.error(`[email] SMTP delivery failed to ${payload.to}, falling back to Resend:`, smtpError);
    }
  }

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
  } else {
    console.log(`[email] Email sent successfully via Resend to ${payload.to}`);
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Sent immediately after a new member account is created.
 * Replaces the old application-confirmation + approval-notification emails.
 * Supports bilingual (EN/ES) output based on member preference.
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  preferredLang?: string | null,
): Promise<void> {
  const lang = normalizeLang(preferredLang);
  const signInUrl = `${portalUrl()}/sign-in`;

  const subject = lang === "es"
    ? "Bienvenido a The Transformation Letter"
    : "Welcome to The Transformation Letter";

  const html = lang === "es"
    ? `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#0F1A2B;line-height:1.6">
  <p>Hola ${escHtml(name)},</p>
  <p>Tu cuenta en <strong>The Transformation Letter</strong> está lista.</p>
  <p>Ahora tienes acceso al archivo bilingüe completo y al asistente de IA de Transformación. Ingresa con el correo y la contraseña que configuraste:</p>
  <p style="margin:24px 0">
    <a href="${signInUrl}" style="background:#C7892A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:sans-serif;font-size:15px;font-weight:700">
      Ingresar al portal →
    </a>
  </p>
  <p style="margin-top:32px">— Wadi</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0">
  <p style="font-size:12px;color:#6B7280">The Transformation Letter · Diagnósticos para owner-operators de $5–100M</p>
</div>`
    : `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#0F1A2B;line-height:1.6">
  <p>Hi ${escHtml(name)},</p>
  <p>Your account on <strong>The Transformation Letter</strong> is ready.</p>
  <p>You now have access to the full bilingual archive and the Transformation AI assistant. Sign in with the email and password you set:</p>
  <p style="margin:24px 0">
    <a href="${signInUrl}" style="background:#C7892A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:sans-serif;font-size:15px;font-weight:700">
      Access the portal →
    </a>
  </p>
  <p style="margin-top:32px">— Wadi</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0">
  <p style="font-size:12px;color:#6B7280">The Transformation Letter · Diagnostics for $5–100M owner-operators</p>
</div>`;

  await send({ to, subject, html });
}

/**
 * Sent to the curator (RESEND_TO) after an edition is successfully published
 * to the portal. Includes a direct link to the live article and QA metadata.
 *
 * Uses RESEND_TO from env (same address the digest digest is sent to).
 * No-ops silently if RESEND_TO is not set.
 */
export async function sendPublicationConfirmation(opts: {
  editionId: string;
  qaScore: number;
  sourcesMirrored: number;
  heroImageUrl?: string | null;
}): Promise<void> {
  const to = process.env.RESEND_TO;
  if (!to) {
    console.warn("[email] RESEND_TO not set — skipping publication confirmation");
    return;
  }
  const articleUrl = `${portalUrl()}/edition/${opts.editionId}`;
  await send({
    to,
    subject: `Publicada: Edición ${opts.editionId} — The Transformation Letter`,
    html: `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#0F1A2B;line-height:1.6">
  <p style="font-size:13px;color:#7A7466;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.05em;">The Transformation Letter</p>
  <h2 style="font-family:'Cormorant Garamond',Garamond,serif;font-size:22px;margin:0 0 16px 0;">Edición ${escHtml(opts.editionId)} publicada ✓</h2>
  <p>El artículo ya está disponible en el portal y el archivo público.</p>
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #C7892A;border-bottom:1px solid #C7892A;padding:8px 0;margin:16px 0;">
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#7A7466;">QA score</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;">${opts.qaScore}/100</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#7A7466;">Fuentes sincronizadas</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;">${opts.sourcesMirrored}</td>
    </tr>
  </table>
  <p style="margin:24px 0">
    <a href="${escHtml(articleUrl)}" style="background:#C7892A;color:#0F1A2B;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:sans-serif;font-size:15px;font-weight:700">
      Ver en el portal →
    </a>
  </p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0">
  <p style="font-size:12px;color:#6B7280">The Transformation Letter · Edición ${escHtml(opts.editionId)}</p>
</div>`,
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
