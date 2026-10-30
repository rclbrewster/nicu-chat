/**
 * Minimal shared-secret session: everyone who knows ACCESS_CODE gets the
 * same session token, stored in a long-lived HttpOnly cookie. No per-user
 * identity, no email round trip. Uses Web Crypto (not node:crypto) so the
 * same code runs in both the Edge middleware and Node route handlers.
 */
export const SESSION_COOKIE = "nicu_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ACCESS_CODE || "";
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<string> {
  return hmacHex("authorized");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token || !secret()) return false;
  return safeEqual(token, await createSessionToken());
}
