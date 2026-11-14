import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions, supabaseKey, supabaseUrl } from "./auth-config";

export { isLive, isMisconfigured } from "./auth-config";

export async function supabase() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Configure both Supabase environment variables.");
  const jar = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) jar.set(name, value, options);
        } catch {
          // The proxy writes refreshed cookies when rendering server components.
        }
      },
    },
  });
}
