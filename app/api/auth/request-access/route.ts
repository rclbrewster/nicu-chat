import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DOMAIN = "@stanford.edu";

// Self-serve: any @stanford.edu email gets the shared access code back
// immediately. This doesn't confirm the requester actually owns that
// inbox (no verification link) -- it's a domain check, not identity
// verification -- but it's consistent with the access code itself being a
// single shared secret with no per-user identity.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();

  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    return NextResponse.json(
      { error: "Access codes are only issued to @stanford.edu email addresses." },
      { status: 403 },
    );
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    console.error("ACCESS_CODE is not set");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("access_requests").insert({ email });
  if (error) {
    console.error("access_requests insert failed:", error.message);
  }

  return NextResponse.json({ ok: true, code: accessCode });
}
