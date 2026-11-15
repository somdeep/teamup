"use server";

import { redirect } from "next/navigation";
import { readSevaAvailability } from "../../lib/seva-preferences";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import type { AuthResult } from "../auth/actions";

export async function saveMyAvailability(_: AuthResult, form: FormData): Promise<AuthResult> {
  if (!isLive) return { error: "Profile editing is unavailable right now." };
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const result = readSevaAvailability(form);
  if ("error" in result) return { error: result.error };

  const { data, error: saveError } = await sevaAvailabilityProfile(client, result.preferences);
  if (saveError) return { error: "We couldn’t save your availability. Please try again." };
  if (!data) redirect("/my-skills");
  redirect("/account?notice=availability-saved");
}
