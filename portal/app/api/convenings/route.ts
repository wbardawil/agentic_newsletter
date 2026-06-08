import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

const Body = z.object({ convening_id: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 422 });

  const { data: conveningData, error: convErr } = await supabase
    .from("convenings_with_counts")
    .select("id, capacity, rsvp_count")
    .eq("id", parsed.data.convening_id)
    .maybeSingle();
  const convening = conveningData as Pick<Database["public"]["Views"]["convenings_with_counts"]["Row"], "id" | "capacity" | "rsvp_count"> | null;

  if (convErr || !convening) {
    return NextResponse.json({ error: "Convening not found" }, { status: 404 });
  }

  const status = convening.rsvp_count >= convening.capacity ? "waitlist" : "confirmed";
  const upsert: Database["public"]["Tables"]["convening_rsvps"]["Insert"] = {
    member_id: user.id,
    convening_id: convening.id,
    status,
    created_at: new Date().toISOString(),
  };

  const { error } = await (supabase
    .from("convening_rsvps") as any)
    .upsert(upsert);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
