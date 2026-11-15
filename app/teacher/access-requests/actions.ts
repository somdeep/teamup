"use server";

import { redirect } from "next/navigation";
import { teacherSession } from "../../../lib/portal-access";
import { readTeacherAccessDecision } from "../../../lib/teacher-access-requests";

export async function reviewTeacherAccess(form: FormData) {
  const decision = readTeacherAccessDecision(form);
  if (!decision) redirect("/teacher/access-requests?notice=review-failed");
  const { client } = await teacherSession();
  const { data, error } = await client.rpc("teamup_review_teacher_access", {
    p_account_id: decision.accountId,
    p_approved: decision.approved,
  });
  const notice = !error && data ? (decision.approved ? "approved" : "declined") : "review-failed";
  redirect(`/teacher/access-requests?notice=${notice}`);
}
