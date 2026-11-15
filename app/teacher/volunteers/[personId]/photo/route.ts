import { isLive, supabase } from "../../../../../lib/supabase";
import { isUuid } from "../../../../../lib/teacher-event";

export async function GET(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!isLive || !isUuid(personId)) return new Response(null, { status: 404, headers });

  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email_confirmed_at) return new Response(null, { status: 404, headers });

  const { data: photo } = await client.rpc("teamup_volunteer_photo", { p_person_id: personId });
  if (typeof photo !== "string" || !photo.startsWith("\\xffd8ff")) {
    return new Response(null, { status: 404, headers });
  }

  return new Response(new Uint8Array(Buffer.from(photo.slice(2), "hex")), {
    headers: { ...headers, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" },
  });
}
