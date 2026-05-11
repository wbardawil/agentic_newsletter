import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const Body = z.object({ convening_id: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 422 });

  const { data: convening, error: convErr } = await supabase
    .from("convenings_with_counts")
    .select("id, capacity, rsvp_count")
    .eq("id", parsed.data.convening_id)
    .maybeSingle();

  if (convErr || !convening) {
    return NextResponse.json({ error: "Convening not found" }, { status: 404 });
  }

  const status = convening.rsvp_count >= convening.capacity ? "waitlist" : "confirmed";

  const { error } = await supabase
    .from("convening_rsvps")
    .upsert({
      member_id: user.id,
      convening_id: convening.id,
      status,
      created_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
