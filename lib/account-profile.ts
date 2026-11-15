import type { SignupProfileInput } from "./signup-profile";
import type { supabase } from "./supabase";
import { readText } from "./auth-input";
import { eventTimeZones } from "./teacher-event";

export type AccountProfile = {
  display_name: string;
  signup_intent: SignupProfileInput["signup_intent"];
  contact_phone: string | null;
  last_course: string | null;
  courses: string[];
  skills: string[];
  location?: string | null;
};

export type EditableAccountProfile = {
  display_name: string;
  contact_phone: string | null;
  city: string | null;
  timezone: string | null;
  last_course: string | null;
};

export function readAccountProfileEdit(form: FormData): { profile: EditableAccountProfile } | { error: string } {
  const displayName = readText(form, "fullName").trim();
  const phone = readText(form, "phone").trim();
  const city = readText(form, "city").trim();
  const timezone = readText(form, "timezone");
  const lastCourse = readText(form, "lastCourse").trim();

  if (!displayName || displayName.length > 100) return { error: "Enter your full name." };
  if (!city || city.length > 100) return { error: "Enter your city or area." };
  if (phone.length > 32) return { error: "Enter a phone number with at most 32 characters." };
  if (lastCourse.length > 120) return { error: "Enter a course name with at most 120 characters." };
  if (!eventTimeZones.some(([value]) => value === timezone)) return { error: "Choose your time zone." };

  return { profile: {
    display_name: displayName,
    contact_phone: phone || null,
    city,
    timezone,
    last_course: lastCourse || null,
  } };
}

export async function accountProfile(client: Awaited<ReturnType<typeof supabase>>, profile?: SignupProfileInput) {
  const result = await client.rpc("teamup_signup_profile_with_location", profile ? { profile } : {});
  // Keep the app usable while the additive migration is awaiting deployment.
  const { data, error } = result.error?.code === "PGRST202"
    ? await client.rpc("teamup_signup_profile", profile ? { profile } : {})
    : result;
  return { data: data as AccountProfile | null, error };
}

export async function editableAccountProfile(
  client: Awaited<ReturnType<typeof supabase>>, profile?: EditableAccountProfile,
) {
  const { data, error } = await client.rpc("teamup_edit_account_profile", profile ? { profile } : {});
  return { data: data as EditableAccountProfile | null, error };
}
