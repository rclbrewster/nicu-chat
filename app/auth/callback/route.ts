import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";
import { emailAllowed } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  // Supabase bounced back an error (e.g. expired link).
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${base}/login?error=link`);
  }

  const supabase = await getServerSupabase();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let email: string | null | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${base}/login?error=link`);
    email = data.user?.email;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) return NextResponse.redirect(`${base}/login?error=link`);
    email = data.user?.email;
  } else {
    return NextResponse.redirect(`${base}/login?error=link`);
  }

  if (!emailAllowed(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${base}/login?error=domain`);
  }

  return NextResponse.redirect(base);
}
