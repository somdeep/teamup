"use server";

import { redirect } from "next/navigation";
import { editableAccountProfile, readAccountProfileEdit } from "../../../lib/account-profile";
import { isLive, supabase } from "../../../lib/supabase";
import type { AuthResult } from "../../auth/actions";

export async function saveAccountProfile(_: AuthResult, form: FormData): Promise<AuthResult> {
  if (!isLive) return { error: "Profile editing is unavailable right now." };
  const client = await supabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const input = readAccountProfileEdit(form);
  if ("error" in input) return { error: input.error };
  const { data, error } = await editableAccountProfile(client, input.profile);
  if (error || !data) return { error: "We couldn’t update your profile. Please try again." };
  redirect("/account?view=settings&notice=profile-details-saved");
}
