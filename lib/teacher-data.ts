import type { teacherSession } from "./portal-access";
import { sevaSkills } from "./signup-profile";

type TeacherSession = Awaited<ReturnType<typeof teacherSession>>;

export type InvitationStatus = "pending" | "accepted" | "declined";
export type PortalInvitation = { id: string; person_id: string; status: InvitationStatus; people: { full_name: string } | null };
export type PortalEvent = {
  id: string; title: string; city: string | null; venue_name: string | null; description: string | null;
  starts_at: string | null; timezone: string; volunteers_needed: number; category: string | null;
  required_skills: string[]; status: string; invitations: PortalInvitation[];
};
export type DirectoryVolunteer = { person_id: string; full_name: string; city: string | null; skills: string[]; skills_simulated?: boolean; emergency_seva?: boolean };
export type MatchedVolunteer = DirectoryVolunteer & { score: number; reasons: string[]; invitation_status: InvitationStatus | null };

export async function teacherEvents({ client, user, profile }: TeacherSession, eventId?: string) {
  const fields = "id,title,city,venue_name,description,starts_at,timezone,volunteers_needed,category,required_skills,status,invitations(id,person_id,status,people(full_name))";
  let query = client.from("events").select(fields);
  query = profile.person_id
    ? query.or(`organizer_user_id.eq.${user.id},organizer_person_id.eq.${profile.person_id}`)
    : query.eq("organizer_user_id", user.id);
  if (eventId) query = query.eq("id", eventId);
  const { data, error } = await query.order("starts_at", { ascending: false, nullsFirst: false }).limit(1000);
  if (error) throw new Error("Could not load your events.");
  return (data ?? []) as unknown as PortalEvent[];
}

export async function teacherDirectory({ client, profile }: TeacherSession, filter: { name: string; city: string; skill: string; page: number }) {
  const pageSize = 24;
  const search = (value: string) => `%${value.slice(0, 80).replace(/[\\%_*]/g, "\\$&")}%`;
  let query = client.from("volunteer_directory").select("person_id,full_name,city,skills,skills_simulated,emergency_seva", { count: "exact" });
  if (filter.name.trim()) query = query.ilike("full_name", search(filter.name.trim()));
  if (filter.city.trim()) query = query.ilike("city", search(filter.city.trim()));
  if (sevaSkills.some(skill => skill === filter.skill)) query = query.contains("skills", [filter.skill]);
  if (profile.person_id) query = query.neq("person_id", profile.person_id);
  const start = (filter.page - 1) * pageSize;
  const { data, error, count } = await query.order("full_name").order("person_id").range(start, start + pageSize - 1);
  if (error) throw new Error("Could not load the volunteer directory.");
  return { volunteers: (data ?? []) as DirectoryVolunteer[], hasNext: (count ?? 0) > start + pageSize };
}

export async function teacherMatches({ client }: TeacherSession, eventId: string) {
  const { data, error } = await client.rpc("match_volunteers", { p_event_id: eventId, p_limit: 24 });
  if (error) throw new Error("Could not load volunteer matches.");
  return (data ?? []) as MatchedVolunteer[];
}
