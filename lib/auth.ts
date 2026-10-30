import { cookies } from "next/headers";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/session";

/**
 * Whether the current request carries a valid shared-access-code session.
 * Use to gate Server Components and Route Handlers.
 */
export async function isAuthorized(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionToken(store.get(SESSION_COOKIE)?.value);
}
