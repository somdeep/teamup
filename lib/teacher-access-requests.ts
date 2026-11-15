import type { teacherSession } from "./portal-access";
import { isUuid } from "./teacher-event";

type TeacherSession = Awaited<ReturnType<typeof teacherSession>>;

export type TeacherAccessRequest = {
  account_id: string;
  full_name: string;
  email: string;
  location: string | null;
  requested_at: string;
};

export function readTeacherAccessDecision(form: FormData) {
  const accountId = form.get("accountId");
  const decision = form.get("decision");
  if (!isUuid(accountId) || (decision !== "approve" && decision !== "decline")) return null;
  return { accountId, approved: decision === "approve" };
}

export async function pendingTeacherAccessRequests({ client }: TeacherSession) {
  const { data, error } = await client.rpc("teamup_pending_teacher_access_requests");
  return { data: (data ?? []) as TeacherAccessRequest[], error };
}
