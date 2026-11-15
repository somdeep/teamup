import type { supabase } from "./supabase";

export const accountRoleLabels = { teacher: "Teacher", volunteer: "Volunteer", member: "Member" } as const;

export type AccountAccess = {
  role: keyof typeof accountRoleLabels;
  teacher_request: "pending" | "approved" | "declined" | null;
};

function profileSaved(notice?: string) {
  return notice === "availability-saved" || notice === "seva-saved";
}

export function teacherLanding(access: AccountAccess | null, view?: string, notice?: string) {
  const saved = profileSaved(notice);
  if (view === "settings" || (notice && !saved)) return null;
  if (access?.role !== "teacher" && access?.teacher_request !== "pending") return null;
  return saved ? "/teacher?notice=profile-saved" : "/teacher";
}

export function volunteerLanding(access: AccountAccess | null, view?: string, notice?: string) {
  const saved = profileSaved(notice);
  if (view === "settings" || (notice && !saved) || access?.role !== "volunteer") return null;
  return saved ? "/volunteer?notice=profile-saved" : "/volunteer";
}

export async function accountAccess(client: Awaited<ReturnType<typeof supabase>>) {
  const { data, error } = await client.rpc("teamup_account_access");
  return { data: data as AccountAccess | null, error };
}
