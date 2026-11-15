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
  parent_event_id: string | null;
  parent_event_title: string | null;
  parent_can_access: boolean;
  related_events: RelatedEvent[];
  confirmed_count: number;
  my_invitation_status: string | null;
  organizer_names: string[];
};

export type RelatedEvent = {
  id: string;
  title: string;
  city: string | null;
  starts_at: string | null;
  timezone: string;
  status: string;
  volunteers_needed: number;
  confirmed_count: number;
  can_access: boolean;
};

export type EventMessage = {
  id: string;
  event_id: string;
  person_id: string;
  author_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  image_path: string | null;
  image_mime: string | null;
  image_size: number | null;
  image_url: string | null;
};

export async function eventCircle({ client }: PortalSession, eventId: string) {
  const { data, error } = await client.rpc("teamup_event_circle", { p_event_id: eventId });
  if (error?.code === "PGRST202") {
    // Lets teachers preview the new UI before the message-board migration is
    // applied to the linked project. Accepted-volunteer access needs the migration.
    const { data: teacherData, error: teacherError } = await client.rpc("teamup_teacher_events", { p_event_id: eventId });
    if (teacherError) return null;
    const event = (teacherData ?? [])[0] as Omit<EventCircle, "ends_at" | "confirmed_count" | "my_invitation_status" | "organizer_names" | "parent_event_title" | "parent_can_access" | "related_events"> & {
      invitations?: { status?: string }[];
      parent_title?: string | null;
    } | undefined;
    if (!event) return null;
    return {
      ...event,
      ends_at: null,
      parent_event_id: event.parent_event_id ?? null,
      parent_event_title: event.parent_title ?? null,
      parent_can_access: false,
      related_events: [],
      confirmed_count: event.invitations?.filter(invitation => invitation.status === "accepted").length ?? 0,
      my_invitation_status: null,
      organizer_names: [],
    };
  }
  if (error) throw new Error("Could not load this event circle.");
  return data as EventCircle | null;
}

export async function eventMessages({ client }: PortalSession, eventId: string) {
  const { data, error } = await client.rpc("teamup_event_messages", { p_event_id: eventId });
  if (error?.code === "PGRST202") return [];
  if (error) throw new Error("Could not load the event messages.");
  const messages = (data ?? []) as Omit<EventMessage, "image_url">[];
  return Promise.all(messages.map(async message => {
    if (!message.image_path) return { ...message, image_url: null };
    const { data: signed } = await client.storage.from("event-message-images")
      .createSignedUrl(message.image_path, 60 * 60);
    return { ...message, image_url: signed?.signedUrl ?? null };
  }));
}

export async function eventIsPast({ client }: PortalSession, eventId: string) {
  const { data, error } = await client.rpc("teamup_event_is_past", { p_event_id: eventId });
  if (error?.code === "PGRST202") return false;
  if (error) throw new Error("Could not check the event status.");
  return data === true;
}
