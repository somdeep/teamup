"use server";

import { redirect } from "next/navigation";
import { portalSession } from "../../lib/portal-access";

export async function requestTeacherAccess() {
  const { client } = await portalSession();
  const { data, error } = await client.rpc("teamup_request_teacher_access");
  if (error || !data) redirect("/account?view=settings&notice=teacher-request-failed");
  redirect("/teacher");
}
