import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TOPIC_IDS } from "@/lib/topics";

const Body = z.object({
  preferred_language: z.enum(["en", "es"]),
  region: z.enum([
    "miami", "monterrey", "bogota", "panama_city", "mexico_city",
    "other_us", "other_latam", "other",
  ]).nullable(),
  industry: z.string().max(120).nullable(),
  role: z.string().max(120).nullable(),
  topics_of_interest: z
    .array(z.string().refine((id) => (TOPIC_IDS as string[]).includes(id), "Unknown topic"))
    .max(TOPIC_IDS.length),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 422 });

  const { error } = await supabase.from("members").update(parsed.data).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
