"use server";

import { redirect } from "next/navigation";
import { volunteerSession } from "../../lib/portal-access";
import { isUuid } from "../../lib/teacher-event";

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
