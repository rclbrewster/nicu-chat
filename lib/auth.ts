import { getServerSupabase } from "@/lib/supabase";

/**
 * Returns the signed-in user, or null. Access itself is gated at sign-up
 * time by the shared access code (see app/api/auth/request-otp/route.ts) —
 * any authenticated Supabase user is authorized from here on.
 */
export async function getAuthorizedUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
