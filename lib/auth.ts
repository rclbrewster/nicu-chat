import { getServerSupabase } from "@/lib/supabase";

export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "stanford.edu")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function emailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedDomains().includes(domain);
}

/**
 * Returns the signed-in user only if their email is in an allowed domain,
 * otherwise null. Use to gate Server Components and Route Handlers.
 */
export async function getAuthorizedUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !emailAllowed(user.email)) return null;
  return user;
}
