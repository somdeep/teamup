import type { portalSession } from "./portal-access";

type PortalSession = Awaited<ReturnType<typeof portalSession>>;

export type EventCircle = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  venue_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  volunteers_needed: number;
  category: string | null;
  status: string;
  can_manage: boolean;
  confirmed_count: number;
  my_invitation_status: string | null;
};

export type EventMessage = {
  id: string;
  event_id: string;
  person_id: string;
  author_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
};

export async function eventCircle({ client }: PortalSession, eventId: string) {
  const { data, error } = await client.rpc("teamup_event_circle", { p_event_id: eventId });
  if (error?.code === "PGRST202") {
    // Lets teachers preview the new UI before the message-board migration is
    // applied to the linked project. Accepted-volunteer access needs the migration.
    const { data: teacherData, error: teacherError } = await client.rpc("teamup_teacher_events", { p_event_id: eventId });
    if (teacherError) return null;
    const event = (teacherData ?? [])[0] as Omit<EventCircle, "ends_at" | "confirmed_count" | "my_invitation_status"> & {
      invitations?: { status?: string }[];
    } | undefined;
    if (!event) return null;
    return {
      ...event,
      ends_at: null,
      confirmed_count: event.invitations?.filter(invitation => invitation.status === "accepted").length ?? 0,
      my_invitation_status: null,
    };
  }
  if (error) throw new Error("Could not load this event circle.");
  return data as EventCircle | null;
}

export async function eventMessages({ client }: PortalSession, eventId: string) {
  const { data, error } = await client.rpc("teamup_event_messages", { p_event_id: eventId });
  if (error?.code === "PGRST202") return [];
  if (error) throw new Error("Could not load the event messages.");
  return (data ?? []) as EventMessage[];
}
