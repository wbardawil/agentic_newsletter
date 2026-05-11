import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

import "./globals.css";

export const metadata: Metadata = {
  title: "The Transformation Letter",
  description:
    "AI business transformation playbooks for $5–100M owner-operators in the US-LATAM corridor.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLangFromCookies();
  const i18n = t(lang);

  return (
    <html lang={lang}>
      <body>
        <SiteHeader lang={lang} />
        <main className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter lang={lang} />
        <span className="sr-only">{i18n.brand.tagline}</span>
      </body>
    </html>
  );
}
