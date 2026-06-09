import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Admin gate. Runs in the Node runtime (Server Component), so the full Supabase
 * client is safe here. Enforces both authentication and the admin-email
 * allowlist for every route under /admin. This used to live in middleware, but
 * the Edge Runtime cannot safely instantiate the Supabase client.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/admin");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = (user.email ?? "").toLowerCase();

  if (!adminEmails.includes(email)) redirect("/me");

  return <>{children}</>;
}
