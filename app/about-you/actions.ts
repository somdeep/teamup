"use server";

import { redirect } from "next/navigation";
import { maxPhotoBytes, readSevaPreferences } from "../../lib/seva-preferences";
import { sevaProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import type { AuthResult } from "../auth/actions";

export async function saveAboutYou(_: AuthResult, form: FormData): Promise<AuthResult> {
  if (!isLive) return { error: "Profile editing is unavailable right now." };
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const result = readSevaPreferences(form);
  if ("error" in result) return { error: result.error };

  const file = form.get("photo");
  let photo: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.type !== "image/jpeg" || file.size > maxPhotoBytes) return { error: "Choose a smaller profile photo and try again." };
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 3).toString("hex") !== "ffd8ff") return { error: "Choose a valid profile photo." };
    photo = bytes.toString("base64");
  }

  const { data, error: saveError } = await sevaProfile(client, {
    preferences: result.preferences,
    photo,
    removePhoto: form.get("removePhoto") === "on",
  });
  if (saveError || !data) return { error: "We couldn’t save your preferences. Please try again." };
  redirect("/account?notice=seva-saved");
}
