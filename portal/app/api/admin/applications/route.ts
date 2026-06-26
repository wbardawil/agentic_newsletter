import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { sendApprovalNotification } from "@/lib/email";

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

  // Read the application before updating so we have name + email for notifications.
  const { data: appRow } = await (admin.from("applications") as any)
    .select("email, full_name, company, role, company_size_band, region, industry, preferred_language, topics_of_interest")
    .eq("id", parsed.data.id)
    .single();

  const update: Database["public"]["Tables"]["applications"]["Update"] = {
    status: parsed.data.status,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  };
  const { error } = await (admin.from("applications") as any)
    .update(update)
    .eq("id", parsed.data.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.status === "approved" && appRow) {
    // ── Provisioning gap fix ───────────────────────────────────────────────────
    // The DB trigger `handle_new_user` only runs on INSERT into auth.users.
    // If the applicant signed in BEFORE being approved, their auth.users row
    // already exists but no members row was created (trigger found status ≠ 'approved').
    // We close that gap here: find the auth user by email and upsert the members row.
    try {
      const { data: authUsers } = await admin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(
        (u) => u.email?.toLowerCase() === (appRow.email as string).toLowerCase(),
      );
      if (authUser) {
        await (admin.from("members") as any).upsert(
          {
            id: authUser.id,
            email: appRow.email,
            full_name: appRow.full_name,
            company: appRow.company,
            role: appRow.role,
            company_size_band: appRow.company_size_band,
            region: appRow.region,
            industry: appRow.industry ?? null,
            preferred_language: appRow.preferred_language,
            topics_of_interest: appRow.topics_of_interest,
            status: "active",
          },
          { onConflict: "id", ignoreDuplicates: false },
        );
      }
    } catch (provErr) {
      console.error("[approve] member provisioning failed:", provErr);
    }

    // Fire-and-log approval email.
    sendApprovalNotification(
      appRow.email as string,
      appRow.full_name as string,
      appRow.preferred_language as string
    ).catch((e) =>
      console.error("[approve] approval email failed:", e),
    );
  }

  return NextResponse.json({ ok: true });
}
