"use server";

import { redirect } from "next/navigation";
import { teacherSession } from "../../lib/portal-access";
import { readEventResource, uploadEventResource } from "../../lib/event-resources";
import { isUuid, readTeacherEvent } from "../../lib/teacher-event";
import type { AuthResult } from "../auth/actions";

export async function createTeacherEvent(_: AuthResult, form: FormData): Promise<AuthResult> {
  const { client, user, profile } = await teacherSession();
  const input = readTeacherEvent(form);
  if ("error" in input) return { error: input.error };
  const resource = readEventResource(form.get("resource"));
  if ("error" in resource) return { error: resource.error };
  const suppliedParent = form.get("parentEventId");
  let parentEventId: string | null = null;
  if (suppliedParent) {
    if (!isUuid(suppliedParent)) return { error: "Choose a valid parent event." };
    const { data, error } = await client.rpc("teamup_teacher_events", { p_event_id: suppliedParent });
    const parent = (data ?? [])[0] as { can_manage?: boolean; parent_event_id?: string | null; child_count?: number } | undefined;
    if (error || !parent?.can_manage || parent.parent_event_id || (parent.child_count ?? 0) >= 5) {
      return { error: "This event cannot accept more related seva." };
    }
    parentEventId = suppliedParent;
  }

  const { error } = await client.from("events").insert({
    ...input.event, parent_event_id: parentEventId,
    organizer_user_id: user.id, organizer_person_id: profile.person_id, source_system: "teamup",
  });
  if (error) {
    if (error.code !== "23505") return { error: parentEventId
      ? "We couldn’t create this related seva. Check the parent event and try again."
      : "We couldn’t create the event. Try again." };
    const { data: existing } = await client.from("events").select("id")
      .eq("id", input.event.id).eq("organizer_user_id", user.id).maybeSingle();
    if (!existing) return { error: "Refresh the event form and try again." };
  }
  if (resource.file) {
    const uploaded = await uploadEventResource(client, user.id, input.event.id, resource);
    if ("error" in uploaded) return { error: `${uploaded.error} The event was created; reopen it to try the attachment again.` };
    const { data: oldPath, error: resourceError } = await client.rpc("teamup_set_event_resource", {
      p_event_id: input.event.id,
      p_storage_path: uploaded.path,
      p_file_name: uploaded.fileName,
      p_mime_type: uploaded.mimeType,
      p_file_size: uploaded.fileSize,
    });
    if (resourceError) {
      await client.storage.from("event-resources").remove([uploaded.path]);
      return { error: "The event was created, but its attachment could not be saved. Open the event to try again." };
    }
    if (typeof oldPath === "string" && oldPath && oldPath !== uploaded.path) {
      await client.storage.from("event-resources").remove([oldPath]);
    }
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

  const { data, error } = await client.rpc("teamup_cancel_invitation", {
    p_event_id: eventId, p_invitation_id: invitationId,
  });
  const notice = !error && data ? "request-cancelled" : "cancel-failed";
  redirect(`/events/${eventId}?notice=${notice}`);
}

export async function reviewApplication(form: FormData) {
  const { client } = await teacherSession();
  const eventId = form.get("eventId");
  const invitationId = form.get("invitationId");
  const response = form.get("response");
  if (!isUuid(eventId) || !isUuid(invitationId) || (response !== "accepted" && response !== "declined")) {
    redirect("/teacher?notice=review-failed");
  }
  const { data, error } = await client.rpc("teamup_review_application", {
    p_invitation_id: invitationId,
    p_response: response,
  });
  redirect(`/events/${eventId}?notice=${!error && data ? `application-${response}` : "review-failed"}`);
}
