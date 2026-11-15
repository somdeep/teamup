"use server";

import { redirect } from "next/navigation";
import { volunteerSession } from "../../lib/portal-access";
import { isUuid } from "../../lib/teacher-event";
import { opportunityBrowseHref, readOpportunityFilter } from "../../lib/volunteer-opportunities";

export async function respondToOpportunity(form: FormData) {
  const { client } = await volunteerSession();
  const invitationId = form.get("invitationId");
  const response = form.get("response");
  if (!isUuid(invitationId) || (response !== "accepted" && response !== "declined")) {
    redirect("/volunteer?view=opportunities&notice=reply-failed");
  }
  const { data, error } = await client.rpc("teamup_reply_to_invitation", {
    p_invitation_id: invitationId,
    p_response: response,
  });
  redirect(`/volunteer?view=opportunities&notice=${!error && data ? "reply-saved" : "reply-failed"}`);
}

export async function cancelCommitment(form: FormData) {
  const { client } = await volunteerSession();
  const invitationId = form.get("invitationId");
  if (!isUuid(invitationId)) redirect("/volunteer?view=commitments&notice=cancel-failed");
  const { data, error } = await client.rpc("teamup_cancel_accepted_invitation", {
    p_invitation_id: invitationId,
  });
  redirect(`/volunteer?view=commitments&notice=${!error && data ? "commitment-cancelled" : "cancel-failed"}`);
}

export async function favoriteOpportunity(form: FormData) {
  const { client } = await volunteerSession();
  const eventId = form.get("eventId");
  const favorite = form.get("favorite") === "true";
  const detail = form.get("detail") === "true";
  const filter = readOpportunityFilter({
    q: typeof form.get("q") === "string" ? String(form.get("q")) : "",
    skill: typeof form.get("skill") === "string" ? String(form.get("skill")) : "",
    city: typeof form.get("city") === "string" ? String(form.get("city")) : "",
    date: typeof form.get("date") === "string" ? String(form.get("date")) : "",
    saved: typeof form.get("saved") === "string" ? String(form.get("saved")) : "",
  });
  if (!isUuid(eventId)) redirect(`${opportunityBrowseHref(filter)}&notice=favorite-failed`);
  const { data, error } = await client.rpc("teamup_favorite_event", {
    p_event_id: eventId,
    p_favorite: favorite,
  });
  const destination = opportunityBrowseHref(filter, detail ? eventId : undefined);
  redirect(`${destination}&notice=${!error && data ? "favorite-saved" : "favorite-failed"}`);
}

export async function applyToOpportunity(form: FormData) {
  const { client } = await volunteerSession();
  const eventId = form.get("eventId");
  const requestedRole = form.get("requestedRole");
  if (!isUuid(eventId) || typeof requestedRole !== "string" || requestedRole.trim().length > 100) {
    redirect("/volunteer?view=opportunities&notice=apply-failed");
  }
  const { data, error } = await client.rpc("teamup_apply_to_event", {
    p_event_id: eventId,
    p_requested_role: requestedRole.trim() || null,
  });
  if (error || !data) redirect(`/volunteer?view=opportunity&event=${eventId}&notice=apply-failed`);
  redirect(`/volunteer?view=applied&event=${eventId}`);
}

export async function respondToRequest(form: FormData) {
  const { client } = await volunteerSession();
  const invitationId = form.get("invitationId");
  const response = form.get("response");
  if (!isUuid(invitationId) || (response !== "accepted" && response !== "declined")) {
    redirect("/volunteer?view=requests&tab=invitations&notice=reply-failed");
  }
  const { data, error } = await client.rpc("teamup_reply_to_invitation", {
    p_invitation_id: invitationId,
    p_response: response,
  });
  redirect(`/volunteer?view=requests&tab=${response === "accepted" ? "confirmed" : "invitations"}&notice=${!error && data ? "reply-saved" : "reply-failed"}`);
}

export async function cancelApplication(form: FormData) {
  const { client } = await volunteerSession();
  const invitationId = form.get("invitationId");
  if (!isUuid(invitationId)) redirect("/volunteer?view=requests&tab=pending&notice=application-cancel-failed");
  const { data, error } = await client.rpc("teamup_cancel_application", { p_invitation_id: invitationId });
  redirect(`/volunteer?view=requests&tab=pending&notice=${!error && data ? "application-cancelled" : "application-cancel-failed"}`);
}

export async function cancelRequestCommitment(form: FormData) {
  const { client } = await volunteerSession();
  const invitationId = form.get("invitationId");
  if (!isUuid(invitationId)) redirect("/volunteer?view=requests&tab=confirmed&notice=cancel-failed");
  const { data, error } = await client.rpc("teamup_cancel_accepted_invitation", { p_invitation_id: invitationId });
  redirect(`/volunteer?view=requests&tab=confirmed&notice=${!error && data ? "commitment-cancelled" : "cancel-failed"}`);
}
