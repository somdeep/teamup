"use server";

import { redirect } from "next/navigation";
import { teacherSession } from "../../lib/portal-access";
import { isUuid, readTeacherEvent } from "../../lib/teacher-event";
import type { AuthResult } from "../auth/actions";

export async function createTeacherEvent(_: AuthResult, form: FormData): Promise<AuthResult> {
  const { client, user, profile } = await teacherSession();
  const input = readTeacherEvent(form);
  if ("error" in input) return { error: input.error };

  const { error } = await client.from("events").insert({
    ...input.event, organizer_user_id: user.id, organizer_person_id: profile.person_id, source_system: "teamup",
  });
  if (error) {
    if (error.code !== "23505") return { error: "We couldn’t create the event. Try again." };
    const { data: existing } = await client.from("events").select("id")
      .eq("id", input.event.id).eq("organizer_user_id", user.id).maybeSingle();
    if (!existing) return { error: "Refresh the event form and try again." };
  }
  redirect(`/events/${input.event.id}?notice=created`);
}

export async function inviteVolunteer(form: FormData) {
  const { client } = await teacherSession();
  const eventId = form.get("eventId");
  const personId = form.get("personId");
  if (!isUuid(eventId) || !isUuid(personId)) redirect("/teacher?notice=invite-failed");

  const { data, error } = await client.rpc("teamup_invite", { p_event_id: eventId, p_person_id: personId });
  const notice = error ? "invite-failed" : data ? "invited" : "already-invited";
  redirect(`/events/${eventId}?notice=${notice}`);
}

export async function cancelInvitation(form: FormData) {
  const { client } = await teacherSession();
  const eventId = form.get("eventId");
  const invitationId = form.get("invitationId");
  if (!isUuid(eventId) || !isUuid(invitationId)) redirect("/teacher?notice=cancel-failed");

  const { data, error } = await client.from("invitations").delete()
    .eq("id", invitationId).eq("event_id", eventId).eq("status", "pending")
    .select("id").maybeSingle();
  const notice = !error && data ? "request-cancelled" : "cancel-failed";
  redirect(`/events/${eventId}?notice=${notice}`);
}
