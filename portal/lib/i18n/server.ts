import { cookies } from "next/headers";

import { normalizeLang, type Lang } from "@/lib/i18n/dictionary";

export const LANG_COOKIE = "tl_lang";

export async function getLangFromCookies(): Promise<Lang> {
  const store = await cookies();
  return normalizeLang(store.get(LANG_COOKIE)?.value);
}
