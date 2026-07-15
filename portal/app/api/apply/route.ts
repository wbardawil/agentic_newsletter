import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { TOPIC_IDS } from "@/lib/topics";
import { sendWelcomeEmail } from "@/lib/email";

const Body = z.object({
  email: z.string().email().max(200),
  full_name: z.string().min(2).max(120),
  company: z.string().min(1).max(160),
  role: z.string().min(1).max(120),
  company_size_band: z.enum(["under_5m", "5m_25m", "25m_50m", "50m_100m", "over_100m"]),
  region: z.enum(["miami", "monterrey", "bogota", "panama_city", "mexico_city", "other_us", "other_latam", "other"]),
  industry: z.string().max(120).optional().nullable(),
  preferred_language: z.enum(["en", "es"]).default("en"),
  topics_of_interest: z
    .array(z.string().refine((id) => (TOPIC_IDS as string[]).includes(id), "Unknown topic"))
    .max(TOPIC_IDS.length)
    .default([]),
  motivation: z.string().min(20).max(2000),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some fields are missing or invalid.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { email, password, full_name, company, role, company_size_band, region,
          industry, preferred_language, topics_of_interest, motivation } = parsed.data;

  // 1. Create the Supabase auth user (email confirmed immediately — no email verification step)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    // Supabase returns a specific message for duplicate email
    if (
      authError.message?.toLowerCase().includes("already") ||
      authError.message?.toLowerCase().includes("duplicate") ||
      authError.message?.toLowerCase().includes("unique")
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }
    console.error("[apply] auth.admin.createUser error:", authError);
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userId = authData.user.id;

  // 2. Insert application record (status: approved — no admin review needed)
  const { error: appError } = await (supabase.from("applications") as any).insert({
    email,
    full_name,
    company,
    role,
    company_size_band,
    region,
    industry: industry ?? null,
    preferred_language,
    topics_of_interest,
    motivation,
    status: "approved",
    decided_at: new Date().toISOString(),
  });

  if (appError) {
    console.error("[apply] applications insert error:", appError);
    // Non-fatal: auth user already created. Continue to members row.
  }

  // 3. Create members row directly (bypasses the DB trigger race condition)
  const { error: memberError } = await (supabase.from("members") as any).upsert(
    {
      id: userId,
      email,
      full_name,
      company,
      role,
      company_size_band,
      region,
      industry: industry ?? null,
      preferred_language,
      topics_of_interest,
      status: "active",
    },
    { onConflict: "id" },
  );

  if (memberError) {
    console.error("[apply] members upsert error:", memberError);
    // Non-fatal: user can still sign in; members row can be repaired manually.
  }

  // 4. Send welcome email — fire-and-log
  sendWelcomeEmail(email, full_name, preferred_language).catch((e) =>
    console.error("[apply] welcome email failed:", e),
  );

  return NextResponse.json({ ok: true });
}
