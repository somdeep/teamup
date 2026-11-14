export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isLive = Boolean(supabaseUrl && supabaseKey);
export const isMisconfigured = Boolean(supabaseUrl) !== Boolean(supabaseKey);

export const sessionCookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" } as const;

export function authOrigin() {
  const configuredUrl = process.env.TEAMUP_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
  const localUrl = process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "";
  try {
    const url = new URL(configuredUrl || (vercelHost ? `https://${vercelHost}` : localUrl));
    if (url.protocol === "https:" || (
      url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )) return url.origin;
  } catch {
    // An invalid deployment URL makes email links unavailable.
  }
  return null;
}
