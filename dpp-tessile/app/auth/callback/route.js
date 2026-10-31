import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "../../../lib/supabase/server";
import { safeCallbackNext } from "../../../lib/auth/next.mjs";

// Target of the links in confirmation and password reset e-mails: exchanges the one-time code for a session.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeCallbackNext(url.searchParams.get("next"));
  if (code && isSupabaseConfigured()) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
