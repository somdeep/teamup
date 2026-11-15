import { redirect } from "next/navigation";
import { accountAccess } from "./account-access";
import { isLive, supabase } from "./supabase";

export async function portalSession() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const [{ data: profile, error: profileError }, { data: access, error: accessError }] = await Promise.all([
    client.from("profiles").select("full_name,person_id").eq("id", user.id).maybeSingle(),
    accountAccess(client),
  ]);
  if (profileError || accessError) throw new Error("Could not confirm your TeamUp profile.");
  if (!profile || !access) redirect("/account");
  return { client, user, profile, access };
}

export async function teacherSession() {
  const session = await portalSession();
  if (session.access.role !== "teacher") redirect("/account?notice=teacher-access");
  return session;
}

export async function volunteerSession() {
  const session = await portalSession();
  if (session.access.role !== "volunteer") redirect("/account");
  return session;
}
