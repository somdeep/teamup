import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./auth-config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function supabaseBrowser() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Configure both Supabase environment variables.");
  browserClient ??= createBrowserClient(supabaseUrl, supabaseKey);
  return browserClient;
}
