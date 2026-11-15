"use server";

import { revalidatePath } from "next/cache";
import { combineFetchMatches } from "../../../lib/fetch/matching";
import type {
  ExactMatchRow, FetchIntent, FetchInvitationResult, FetchSearchResult, PreferenceMatchRow,
} from "../../../lib/fetch/types";
import { teacherSession } from "../../../lib/portal-access";
import { sevaSkills } from "../../../lib/signup-profile";
import { teacherEvents } from "../../../lib/teacher-data";
import { isOpenEvent, isUuid } from "../../../lib/teacher-event";

function validIntent(intent: FetchIntent) {
  return intent.eventId && isUuid(intent.eventId)
    && intent.skills.length > 0
    && intent.skills.every(skill => sevaSkills.some(option => option === skill))
    && (intent.quantity === null || Number.isInteger(intent.quantity) && intent.quantity >= 1 && intent.quantity <= 20);
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
