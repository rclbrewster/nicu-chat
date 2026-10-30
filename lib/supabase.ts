import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only. Never import into a
 * "use client" module. This is the only Supabase client the app uses now;
 * access control is the shared-access-code session (see lib/session.ts),
 * not Supabase Auth.
 */
export function getServiceSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
