import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Manrope } from "next/font/google";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Transformation Letter — Wadi Bardawil",
  description:
    "Diagnostics for $5–100M owner-operators across business transformation, conscious capital, family business, family office, AI, and tech — in the US-LATAM corridor.",
  icons: { icon: "/favicon.png" },
};

export const viewport = {
  themeColor: "#222831",
  colorScheme: "dark" as const,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLangFromCookies();
  const i18n = t(lang);

  return (
    <html lang={lang} className={`dark ${archivo.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body>
        {/* Apply the saved theme before hydration to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("wb-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}',
          }}
        />
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
