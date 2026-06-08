import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import type { Database } from "@/lib/supabase/types";

import { ApplicationRow } from "./row";

const FILTERS = ["pending", "approved", "rejected", "waitlisted"] as const;
type Filter = (typeof FILTERS)[number];

export const metadata = { title: "Applications — Admin" };

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(status ?? "")
    ? (status as Filter)
    : "pending";

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin/applications");

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("status", filter)
    .order("created_at", { ascending: false });

  // Ensure strong typing for application rows to avoid `never` inference
  type Application = Database["public"]["Tables"]["applications"]["Row"];
  const apps: Application[] = data ?? [];

  const lang = await getLangFromCookies();
  const i18n = t(lang).admin;

  return (
    <section className="container-wide py-12">
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl">{i18n.applications}</h1>
        <nav className="flex gap-2 text-sm">
          {FILTERS.map((f) => (
            <a
              key={f}
              href={`?status=${f}`}
              className={`px-3 py-1 rounded border ${filter === f ? "bg-[var(--color-fg)] text-[var(--color-bg)] border-[var(--color-fg)]" : "border-[var(--color-line)] text-[var(--color-fg-muted)]"}`}
            >
              {f}
            </a>
          ))}
        </nav>
      </header>

      {error ? <p className="text-sm text-red-700">{error.message}</p> : null}

      <div className="space-y-3">
        {apps.map((app) => (
          <ApplicationRow key={app.id} app={app} lang={lang} />
        ))}
        {apps.length === 0 ? (
          <p className="text-[var(--color-fg-muted)]">No applications in this bucket.</p>
        ) : null}
      </div>
    </section>
  );
}
