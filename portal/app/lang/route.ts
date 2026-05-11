import { NextResponse } from "next/server";

import { LANG_COOKIE } from "@/lib/i18n/server";
import { normalizeLang } from "@/lib/i18n/dictionary";
import { withBase } from "@/lib/site";

export async function POST(request: Request) {
  const formData = await request.formData();
  const lang = normalizeLang(formData.get("lang")?.toString());
  const rawNext = formData.get("next")?.toString() || "/";
  const next = rawNext.startsWith("/") ? withBase(rawNext) : rawNext;

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
