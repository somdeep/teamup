import { authOrigin, supabaseKey, supabaseUrl } from "./auth-config";

export async function isGoogleAvailable() {
  if (!supabaseKey || !supabaseUrl || !authOrigin()) return false;

  try {
    const response = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
      headers: { apikey: supabaseKey },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
