import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

const Body = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "waitlisted", "pending"]),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = (user.email ?? "").toLowerCase();
  if (!adminEmails.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const admin = getSupabaseAdminClient();
  const update: Database["public"]["Tables"]["applications"]["Update"] = {
    status: parsed.data.status,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  };
  const { error } = await (admin
    .from("applications") as any)
    .update(update)
    .eq("id", parsed.data.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
