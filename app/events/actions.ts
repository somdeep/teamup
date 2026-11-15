"use server";

import { redirect } from "next/navigation";
import { portalSession } from "../../lib/portal-access";
import { isUuid } from "../../lib/teacher-event";

export async function postEventMessage(form: FormData) {
  const eventId = form.get("eventId");
  const body = form.get("body");
  if (!isUuid(eventId) || typeof body !== "string" || !body.trim() || body.trim().length > 1000) {
    if (isUuid(eventId)) redirect(`/events/${eventId}?notice=message-failed#message-board`);
    redirect("/account");
  }

  const { client } = await portalSession();
  const { data, error } = await client.rpc("teamup_post_event_message", {
    p_event_id: eventId,
    p_body: body,
  });
  redirect(`/events/${eventId}?notice=${!error && data ? "message-posted" : "message-failed"}#message-board`);
}
