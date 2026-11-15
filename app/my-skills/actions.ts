"use server";

import { redirect } from "next/navigation";
import { readSevaSkills } from "../../lib/seva-preferences";
import { sevaSkillsProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import type { AuthResult } from "../auth/actions";

export async function saveMySkills(_: AuthResult, form: FormData): Promise<AuthResult> {
  if (!isLive) return { error: "Profile editing is unavailable right now." };
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const selections = readSevaSkills(form);
  if (!selections) return { error: "Choose skills and learning interests from the list." };

  const { data, error: saveError } = await sevaSkillsProfile(client, selections);
  if (saveError) return { error: "We couldn’t save your skills. Please try again." };
  if (!data) redirect("/about-you");
  redirect("/account?notice=skills-saved");
}
