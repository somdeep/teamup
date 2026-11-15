import type { teacherSession } from "./portal-access";
import type { DirectoryFilter, VolunteerAvailability } from "./volunteer-directory";

type TeacherSession = Awaited<ReturnType<typeof teacherSession>>;

const eventRoleLabels = {
  organizer: "Organizer", co_organizer: "Co-Organizer", coordinator: "Coordinator",
  teacher: "Teacher", co_teacher: "Co-Teacher",
} as const;

export type InvitationStatus = "pending" | "accepted" | "declined";
export type PortalInvitation = { id: string; person_id: string; status: InvitationStatus; people: { full_name: string } | null };
export type PortalEvent = {
  id: string; title: string; city: string | null; venue_name: string | null; description: string | null;
  starts_at: string | null; timezone: string; volunteers_needed: number; category: string | null;
  required_skills: string[]; status: string; invitations: PortalInvitation[];
  parent_event_id: string | null; parent_title: string | null; child_count: number;
  roles: (keyof typeof eventRoleLabels)[]; can_manage: boolean;
};
export type DirectoryVolunteer = { person_id: string; full_name: string; city: string | null; skills: string[]; skills_simulated?: boolean; emergency_seva?: boolean };
export type VolunteerDirectoryProfile = DirectoryVolunteer & {
  interests: string[];
  availability_status: VolunteerAvailability;
  availability_patterns: string[];
  past_seva_count: number;
  has_photo: boolean;
};
export type MatchedVolunteer = DirectoryVolunteer & { score: number; reasons: string[]; invitation_status: InvitationStatus | null };

export function eventRoles(event: PortalEvent) {
  return event.roles.map(role => eventRoleLabels[role]).join(" · ");
}

export async function teacherEvents({ client }: TeacherSession, eventId?: string) {
  const { data, error } = await client.rpc("teamup_teacher_events", { p_event_id: eventId ?? null });
  if (error) throw new Error("Could not load your events.");
  return (data ?? []) as PortalEvent[];
}

const directoryColumns = "person_id,full_name,city,skills,interests,skills_simulated,emergency_seva,availability_status,availability_patterns,past_seva_count,has_photo";

export async function teacherDirectory({ client, profile }: TeacherSession, filter: DirectoryFilter) {
  const pageSize = 12;
  const search = (value: string) => `%${value.slice(0, 80).replace(/[\\%_*]/g, "\\$&")}%`;
  let query = client.from("volunteer_directory").select(directoryColumns);
  if (filter.q) query = query.ilike("search_text", search(filter.q));
  if (filter.city) query = query.ilike("city", search(filter.city));
  if (filter.skill) query = query.contains("skills", [filter.skill]);
  if (filter.availability) query = query.eq("availability_status", filter.availability);
  if (profile.person_id) query = query.neq("person_id", profile.person_id);
  const start = (filter.page - 1) * pageSize;
  const { data, error } = await query.order("full_name").order("person_id").range(start, start + pageSize);
  if (error) throw new Error("Could not load the volunteer directory.");
  return { volunteers: (data ?? []).slice(0, pageSize) as VolunteerDirectoryProfile[], hasNext: (data?.length ?? 0) > pageSize };
}

export async function teacherVolunteer({ client, profile }: TeacherSession, personId: string) {
  if (personId === profile.person_id) return null;
  const { data, error } = await client.from("volunteer_directory").select(directoryColumns)
    .eq("person_id", personId).maybeSingle();
  if (error) throw new Error("Could not load the volunteer profile.");
  return data as VolunteerDirectoryProfile | null;
}

export async function teacherVolunteerPhone({ client }: TeacherSession, personId: string) {
  const { data, error } = await client.rpc("teamup_volunteer_phone", { p_person_id: personId });
  if (error) throw new Error("Could not load the volunteer contact option.");
  return typeof data === "string" && data.trim() ? data.trim() : null;
}

export async function teacherMatches({ client }: TeacherSession, eventId: string) {
  const { data, error } = await client.rpc("match_volunteers", { p_event_id: eventId, p_limit: 24 });
  if (error) throw new Error("Could not load volunteer matches.");
  return (data ?? []) as MatchedVolunteer[];
}
