import { NextResponse, type NextRequest } from "next/server";
import { isLive } from "../../../lib/auth-config";
import { supabase } from "../../../lib/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (isLive && code && !request.nextUrl.searchParams.has("error")) {
    const client = await supabase();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && data.session) return redirectTo("/account");
  }

  return redirectTo("/login?notice=google-failed");
}

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
