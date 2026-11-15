import type { volunteerSession } from "./portal-access";
import { sevaSkills } from "./signup-profile";
import { isUuid } from "./teacher-event";

type VolunteerSession = Awaited<ReturnType<typeof volunteerSession>>;

export type OpportunityDateFilter = "" | "7" | "30";
export type OpportunityFilter = {
  q: string;
  skill: string;
  city: string;
  date: OpportunityDateFilter;
  saved: boolean;
};

export type VolunteerOpportunity = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  venue_name: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  category: string | null;
  organizer_names: string[];
  required_skills: string[];
  volunteers_needed: number;
  confirmed_count: number;
  spots_left: number;
  is_favorite: boolean;
  invitation_status: "pending" | "accepted" | "declined" | null;
  request_source: "teacher_invitation" | "volunteer_application" | null;
  requested_role: string | null;
};

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export function readOpportunityFilter(params: Record<string, string | string[] | undefined>): OpportunityFilter {
  const skill = one(params.skill);
  const date = one(params.date);
  return {
    q: one(params.q).trim().slice(0, 80),
    skill: sevaSkills.some(option => option === skill) ? skill : "",
    city: one(params.city).trim().slice(0, 80),
    date: date === "7" || date === "30" ? date : "",
    saved: one(params.saved) === "1",
  };
}

export function opportunityBrowseHref(filter: OpportunityFilter, eventId?: string) {
  const params = new URLSearchParams({ view: eventId ? "opportunity" : "opportunities" });
  if (eventId && isUuid(eventId)) params.set("event", eventId);
  if (filter.q) params.set("q", filter.q);
  if (filter.skill) params.set("skill", filter.skill);
  if (filter.city) params.set("city", filter.city);
  if (filter.date) params.set("date", filter.date);
  if (filter.saved) params.set("saved", "1");
  return `/volunteer?${params}`;
}

export async function browseVolunteerOpportunities(
  { client }: VolunteerSession,
  filter: OpportunityFilter,
  eventId?: string,
  now = Date.now(),
) {
  const days = filter.date ? Number(filter.date) : 0;
  const startsBefore = days ? new Date(now + days * 86_400_000).toISOString() : null;
  const { data, error } = await client.rpc("teamup_browse_opportunities", {
    p_query: filter.q || null,
    p_skill: filter.skill || null,
    p_city: filter.city || null,
    p_starts_before: startsBefore,
    p_event_id: eventId && isUuid(eventId) ? eventId : null,
    p_limit: eventId ? 1 : filter.saved ? 50 : 24,
    p_offset: 0,
  });
  if (error?.code === "PGRST202") return { opportunities: [] as VolunteerOpportunity[], unavailable: true };
  if (error) throw new Error("Could not load seva opportunities.");
  const opportunities = (data ?? []) as VolunteerOpportunity[];
  return { opportunities: filter.saved && !eventId ? opportunities.filter(item => item.is_favorite) : opportunities, unavailable: false };
}
