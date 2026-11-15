import type { InvitationStatus, PortalEvent } from "../teacher-data";

export type FetchAnimation = "idle" | "playful" | "searching" | "digging" | "success" | "no-results" | "sleeping" | "zen";

export type FetchEvent = Pick<PortalEvent,
  "id" | "title" | "city" | "starts_at" | "timezone" | "required_skills" | "volunteers_needed" | "invitations" | "can_manage"
>;

export type FetchIntent = {
  raw: string;
  eventId: string | null;
  eventTitle: string | null;
  skills: string[];
  quantity: number | null;
  urgentOnly: boolean;
  skillSource: "query" | "event" | null;
  clarification: string | null;
};

export type ExactMatchRow = {
  person_id: string;
  full_name: string;
  city: string | null;
  skills: string[] | null;
  matched_skills: string[] | null;
  available: boolean;
  same_city: boolean;
  score: number | string;
  reasons: string[] | null;
  invitation_status: InvitationStatus | null;
};

export type PreferenceMatchRow = {
  person_id: string;
  full_name: string;
  city: string | null;
  skills: string[] | null;
  matched_skills: string[] | null;
  same_city: boolean;
  emergency_seva: boolean;
  reasons: string[] | null;
  invitation_status: InvitationStatus | null;
};

export type FetchMatch = {
  personId: string;
  fullName: string;
  city: string | null;
  skills: string[];
  matchedSkills: string[];
  availability: "full-event" | "general-preference";
  sameCity: boolean;
  emergencySeva: boolean;
  invitationStatus: InvitationStatus | null;
  reasons: string[];
  score: number;
};

export type FetchSearchResult = {
  ok: boolean;
  error?: string;
  matches: FetchMatch[];
  total: number;
  eventId?: string;
};

export type FetchInvitationResult = {
  ok: boolean;
  error?: string;
  sent: string[];
  alreadyInvited: string[];
  failed: string[];
};
