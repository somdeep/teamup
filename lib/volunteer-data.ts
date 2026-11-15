import type { volunteerSession } from "./portal-access";

type VolunteerSession = Awaited<ReturnType<typeof volunteerSession>>;

export type VolunteerInvitationStatus = "pending" | "accepted" | "declined";
export type VolunteerRequestSource = "teacher_invitation" | "volunteer_application";

export type VolunteerEvent = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  venue_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  status: string;
  category: string | null;
};

export type VolunteerInvitation = {
  id: string;
  status: VolunteerInvitationStatus;
  invited_at: string;
  request_source: VolunteerRequestSource;
  requested_role: string | null;
  events: VolunteerEvent | null;
};

export type VolunteerInvitationGroups = {
  opportunities: VolunteerInvitation[];
  commitments: VolunteerInvitation[];
  history: VolunteerInvitation[];
  upcoming: VolunteerInvitation[];
};

function eventTime(invitation: VolunteerInvitation) {
  return invitation.events?.starts_at ? Date.parse(invitation.events.starts_at) : Number.POSITIVE_INFINITY;
}

export function groupVolunteerInvitations(
  invitations: VolunteerInvitation[], now = Date.now(),
): VolunteerInvitationGroups {
  const isFuture = (item: VolunteerInvitation) => item.events?.status === "scheduled"
    && !!item.events.starts_at && Date.parse(item.events.starts_at) > now;
  const isPast = (item: VolunteerInvitation) => item.events?.status === "completed"
    || (!!item.events?.ends_at && Date.parse(item.events.ends_at) < now);
  const byTime = (a: VolunteerInvitation, b: VolunteerInvitation) => eventTime(a) - eventTime(b)
    || a.id.localeCompare(b.id);

  const opportunities = invitations.filter(item => item.status === "pending"
    && item.request_source === "teacher_invitation" && isFuture(item)).sort(byTime);
  const commitments = invitations.filter(item => item.status === "accepted" && isFuture(item)).sort(byTime);
  const history = invitations.filter(item => item.status === "accepted" && isPast(item)).sort((a, b) => byTime(b, a));
  return {
    opportunities,
    commitments,
    history,
    upcoming: [...opportunities, ...commitments].sort(byTime),
  };
}

export async function volunteerInvitations({ client, profile }: VolunteerSession) {
  if (!profile.person_id) return [];
  const { data, error } = await client.from("invitations")
    .select("id,status,invited_at,request_source,requested_role,events(id,title,description,city,venue_name,starts_at,ends_at,timezone,status,category)")
    .eq("person_id", profile.person_id)
    .order("invited_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Could not load your seva opportunities.");
  return (data ?? []) as unknown as VolunteerInvitation[];
}
