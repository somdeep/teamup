import { isLive, supabase } from "../../../lib/supabase";

export async function GET() {
  if (!isLive) return new Response(null, { status: 404 });
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return new Response(null, { status: 404 });

  const { data } = await client.from("profiles").select("seva_photo").eq("id", user.id).maybeSingle();
  const photo = data?.seva_photo;
  if (typeof photo !== "string" || !photo.startsWith("\\x")) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(Buffer.from(photo.slice(2), "hex")), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
