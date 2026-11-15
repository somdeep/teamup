import type { supabase } from "./supabase";

export const accountRoleLabels = { teacher: "Teacher", volunteer: "Volunteer", member: "Member" } as const;

export type AccountAccess = {
  role: keyof typeof accountRoleLabels;
  teacher_request: "pending" | "approved" | "declined" | null;
};

export function teacherLanding(access: AccountAccess | null, view?: string, notice?: string) {
  if (view === "settings" || (notice && notice !== "availability-saved")) return null;
  if (access?.role !== "teacher" && access?.teacher_request !== "pending") return null;
  return notice === "availability-saved" ? "/teacher?notice=profile-saved" : "/teacher";
}

export async function accountAccess(client: Awaited<ReturnType<typeof supabase>>) {
  const { data, error } = await client.rpc("teamup_account_access");
  return { data: data as AccountAccess | null, error };
}
