import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Request-scoped client that reads/writes the Supabase auth cookies.
 * Use in Server Components, Route Handlers, and Server Actions.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...(options ?? {}) } as never),
          );
        } catch {
          // Called from a Server Component — safe to ignore, middleware refreshes.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Server-only. Never import into a
 * "use client" module.
 */
export function getServiceSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
