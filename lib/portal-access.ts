import { redirect } from "next/navigation";
import { isLive, supabase } from "./supabase";

export async function portalSession() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const { data: profile, error: profileError } = await client.from("profiles")
    .select("full_name,role,person_id").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error("Could not confirm your TeamUp profile.");
  if (!profile) redirect("/account");
  return { client, user, profile };
}

export async function teacherSession() {
  const session = await portalSession();
  if (session.profile.role !== "organizer") redirect("/account?notice=teacher-access");
  return session;
}
