import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Constant-time string compare so a mistyped code can't be distinguished
// from a correct one by response timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    console.error("ACCESS_CODE is not set");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!code || !safeEqual(code, accessCode)) {
    return NextResponse.json({ error: "Incorrect access code." }, { status: 403 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const supabase = getServiceSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("signInWithOtp failed:", error.message);
    return NextResponse.json({ error: "Could not send a code. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
