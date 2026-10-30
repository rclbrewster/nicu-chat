import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const code = String(body.code ?? "").trim();
  if (!code || !safeEqual(code, accessCode)) {
    return NextResponse.json({ error: "Incorrect access code." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
