"use server";

import { revalidatePath } from "next/cache";
import { combineFetchMatches } from "../../../lib/fetch/matching";
import { parseFetchIntent } from "../../../lib/fetch/intent";
import type {
  ExactMatchRow, FetchEvent, FetchIntent, FetchInterpretationResult, FetchInvitationResult, FetchSearchResult, PreferenceMatchRow,
} from "../../../lib/fetch/types";
import { teacherSession } from "../../../lib/portal-access";
import { sevaSkills } from "../../../lib/signup-profile";
import { teacherEvents } from "../../../lib/teacher-data";
import { isOpenEvent, isUuid } from "../../../lib/teacher-event";
import { interpretWithOpenAi } from "./openai-intent";

function validIntent(intent: FetchIntent) {
  return intent.eventId && isUuid(intent.eventId)
    && intent.skills.length > 0
    && intent.skills.every(skill => sevaSkills.some(option => option === skill))
    && (intent.quantity === null || Number.isInteger(intent.quantity) && intent.quantity >= 1 && intent.quantity <= 20);
}

function interpretationMode() {
  const configured = process.env.FETCH_INTERPRETATION_MODE?.trim().toLocaleLowerCase();
  if (configured === "deterministic" || configured === "ai-first") return configured;
  return process.env.OPENAI_API_KEY ? "ai-first" : "deterministic";
}

type FetchRateLimitClaim = {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
};

type LocalFetchRateLimit = { windowStartedAt: number; count: number };
const fetchGlobal = globalThis as typeof globalThis & { __teamupFetchLlmRateLimit?: LocalFetchRateLimit };
const FETCH_REQUESTS_PER_HOUR = 50;

function claimLocalDevelopmentFetchRequest(now = Date.now()): FetchRateLimitClaim {
  const hour = 60 * 60 * 1000;
  const windowStartedAt = Math.floor(now / hour) * hour;
  const current = fetchGlobal.__teamupFetchLlmRateLimit;
  const state = !current || current.windowStartedAt !== windowStartedAt
    ? { windowStartedAt, count: 0 }
    : current;
  const retryAfter = Math.max(1, Math.ceil((windowStartedAt + hour - now) / 1000));
  if (state.count >= FETCH_REQUESTS_PER_HOUR) return { allowed: false, remaining: 0, retry_after_seconds: retryAfter };
  state.count += 1;
  fetchGlobal.__teamupFetchLlmRateLimit = state;
  return { allowed: true, remaining: FETCH_REQUESTS_PER_HOUR - state.count, retry_after_seconds: retryAfter };
}

export async function interpretFetchQuery(raw: string, selectedEventId?: string): Promise<FetchInterpretationResult> {
  const query = raw.trim().slice(0, 350);
  const session = await teacherSession();
  const manageable = (await teacherEvents(session))
    .filter(event => event.can_manage && isOpenEvent(event)) as FetchEvent[];

  const deterministic = () => parseFetchIntent(query, manageable, selectedEventId);
  if (!query || !manageable.length) {
    return { ok: true, intent: deterministic(), source: "deterministic" };
  }
  if (interpretationMode() === "deterministic") {
    return { ok: true, intent: deterministic(), source: "deterministic" };
  }

  const { data: claimData, error: claimError } = await session.client.rpc("teamup_claim_fetch_llm_request", { p_limit: FETCH_REQUESTS_PER_HOUR });
  const claim = claimError && process.env.NODE_ENV !== "production"
    ? claimLocalDevelopmentFetchRequest()
    : claimData as FetchRateLimitClaim | null;
  if (!claim) {
    return {
      ok: true,
      intent: deterministic(),
      source: "deterministic",
      warning: "The global AI usage guard is unavailable, so Fetch used its standard interpreter without calling AI.",
    };
  }
  if (!claim.allowed) {
    const minutes = Math.max(1, Math.ceil((claim.retry_after_seconds ?? 3600) / 60));
    return {
      ok: true,
      intent: deterministic(),
      source: "deterministic",
      warning: `The shared Fetch AI limit of ${FETCH_REQUESTS_PER_HOUR} requests per hour has been reached. Try AI again in about ${minutes} minute${minutes === 1 ? "" : "s"}; standard interpretation is still available.`,
    };
  }

  const ai = await interpretWithOpenAi(query, manageable, selectedEventId);
  if (ai.ok) return { ok: true, intent: ai.intent, source: "ai" };

  return {
    ok: true,
    intent: deterministic(),
    source: "deterministic",
    warning: `${ai.error} Fetch used its standard interpreter instead.`,
  };
}

export async function searchFetchVolunteers(intent: FetchIntent): Promise<FetchSearchResult> {
  if (!validIntent(intent)) return { ok: false, error: "Fetch needs a valid event, skill, and quantity.", matches: [], total: 0 };

  const session = await teacherSession();
  const events = await teacherEvents(session, intent.eventId ?? undefined);
  const event = events[0];
  if (!event?.can_manage || !isOpenEvent(event)) {
    return { ok: false, error: "You can only use Fetch for an upcoming event you manage.", matches: [], total: 0 };
  }

  const [exact, preference] = await Promise.all([
    session.client.rpc("match_volunteers", {
      p_event_id: event.id, p_limit: 100, p_include_unavailable: false,
    }),
    session.client.rpc("recommend_volunteers", { p_event_id: event.id, p_limit: 100 }),
  ]);
  if (exact.error && preference.error) {
    return { ok: false, error: "Fetch couldn’t check volunteer availability. Please try again.", matches: [], total: 0 };
  }

  const matches = combineFetchMatches(
    exact.error ? [] : (exact.data ?? []) as ExactMatchRow[],
    preference.error ? [] : (preference.data ?? []) as PreferenceMatchRow[],
    intent,
  );
  return { ok: true, matches, total: matches.length, eventId: event.id };
}

export async function sendFetchInvitations(eventId: string, personIds: string[]): Promise<FetchInvitationResult> {
  const uniquePeople = [...new Set(personIds)];
  if (!isUuid(eventId) || uniquePeople.length < 1 || uniquePeople.length > 20 || uniquePeople.some(personId => !isUuid(personId))) {
    return { ok: false, error: "Choose between 1 and 20 valid volunteers.", sent: [], alreadyInvited: [], failed: [] };
  }

  const session = await teacherSession();
  const events = await teacherEvents(session, eventId);
  const event = events[0];
  if (!event?.can_manage || !isOpenEvent(event)) {
    return { ok: false, error: "You can only invite volunteers to an upcoming event you manage.", sent: [], alreadyInvited: [], failed: uniquePeople };
  }

  const accepted = event.invitations.filter(invitation => invitation.status === "accepted").length;
  const pending = event.invitations.filter(invitation => invitation.status === "pending").length;
  const remaining = Math.max(0, event.volunteers_needed - accepted - pending);
  if (uniquePeople.length > remaining) {
    return {
      ok: false,
      error: remaining
        ? `Select no more than ${remaining} volunteer${remaining === 1 ? "" : "s"}; the other event spots already have accepted or pending invitations.`
        : "This event has no unfilled invitation spots.",
      sent: [], alreadyInvited: [], failed: [],
    };
  }

  const sent: string[] = [];
  const alreadyInvited: string[] = [];
  const failed: string[] = [];
  for (const personId of uniquePeople) {
    const { data, error } = await session.client.rpc("teamup_invite", { p_event_id: event.id, p_person_id: personId });
    if (error) failed.push(personId);
    else if (data) sent.push(personId);
    else alreadyInvited.push(personId);
  }

  revalidatePath("/teacher");
  revalidatePath(`/events/${event.id}`);
  return {
    ok: failed.length === 0,
    ...(failed.length ? { error: "Some invitations could not be sent. Refresh the event before trying again." } : {}),
    sent, alreadyInvited, failed,
  };
}
