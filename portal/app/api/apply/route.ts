import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  email: z.string().email().max(200),
  full_name: z.string().min(2).max(120),
  company: z.string().min(1).max(160),
  role: z.string().min(1).max(120),
  company_size_band: z.enum(["under_5m", "5m_25m", "25m_50m", "50m_100m", "over_100m"]),
  region: z.enum(["miami", "monterrey", "bogota", "panama_city", "mexico_city", "other_us", "other_latam", "other"]),
  industry: z.string().max(120).optional().nullable(),
  preferred_language: z.enum(["en", "es"]).default("en"),
  motivation: z.string().min(20).max(2000),
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
  const { error } = await supabase.from("applications").insert({
    ...parsed.data,
    industry: parsed.data.industry ?? null,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "An application from this email is already pending review." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
