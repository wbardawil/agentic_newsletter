import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign out and bounce the user OUT of the portal back to the apex domain
 * (which Lovable serves). We intentionally drop the basePath here.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
