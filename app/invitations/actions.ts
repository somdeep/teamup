"use server";

import { redirect } from "next/navigation";
import { portalSession } from "../../lib/portal-access";
import { isUuid } from "../../lib/teacher-event";

export async function replyToInvitation(form: FormData) {
  const { client } = await portalSession();
  const id = form.get("invitationId");
  const response = form.get("response");
  if (!isUuid(id) || (response !== "accepted" && response !== "declined")) redirect("/invitations?notice=reply-failed");
  const { data, error } = await client.rpc("teamup_reply_to_invitation", { p_invitation_id: id, p_response: response });
  redirect(`/invitations?notice=${!error && data ? "saved" : "reply-failed"}`);
}
