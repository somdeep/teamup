import type { AccountAccess } from "./account-access";
import type { supabase } from "./supabase";

type Client = Awaited<ReturnType<typeof supabase>>;
type TeacherEventResult = { invitations?: { status?: string }[] };

export async function portalNotifications(client: Client, accountId: string, access: AccountAccess | null) {
  if (access?.role === "teacher") {
    const { data } = await client.rpc("teamup_teacher_events", { p_event_id: null });
    const events = (data ?? []) as TeacherEventResult[];
    return {
      href: "/teacher?view=requests",
      label: "Volunteer requests",
      pending: events.flatMap(event => event.invitations ?? []).filter(invite => invite.status === "pending").length,
    };
  }

  const { data: profile } = await client.from("profiles").select("person_id").eq("id", accountId).maybeSingle();
  if (!profile?.person_id) return { href: "/volunteer?view=requests&tab=invitations", label: "Invitations", pending: 0 };
  const { count } = await client.from("invitations").select("id", { count: "exact", head: true })
    .eq("person_id", profile.person_id).eq("status", "pending").eq("request_source", "teacher_invitation");
  return { href: "/volunteer?view=requests&tab=invitations", label: "Invitations", pending: count ?? 0 };
}
