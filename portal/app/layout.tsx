import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

import "./globals.css";

export const metadata: Metadata = {
  title: "The Transformation Letter — Wadi Bardawil",
  description:
    "Diagnostics for $5–100M owner-operators across business transformation, conscious capital, family business, family office, AI, and tech — in the US-LATAM corridor.",
  icons: { icon: "/favicon.png" },
};

export const viewport = {
  themeColor: "#22252a",
  colorScheme: "dark" as const,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLangFromCookies();
  const i18n = t(lang);

  return (
    <html lang={lang} className="dark">
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
