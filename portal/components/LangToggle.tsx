"use client";

import { usePathname, useSearchParams } from "next/navigation";

import type { Lang } from "@/lib/i18n/dictionary";

export function LangToggle({ current }: { current: Lang }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <form action="/lang" method="post" className="flex items-center gap-1 text-xs">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        name="lang"
        value="en"
        aria-pressed={current === "en"}
        className={`px-2 py-1 rounded ${current === "en" ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-bronze)]"}`}
      >
        EN
      </button>
      <span className="text-[var(--color-bronze)]">·</span>
      <button
        type="submit"
        name="lang"
        value="es"
        aria-pressed={current === "es"}
        className={`px-2 py-1 rounded ${current === "es" ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-bronze)]"}`}
      >
        ES
      </button>
    </form>
  );
}
