import type { SignupProfileInput } from "./signup-profile";
import type { supabase } from "./supabase";

type AccountProfile = {
  display_name: string;
  signup_intent: SignupProfileInput["signup_intent"];
  contact_phone: string | null;
  last_course: string | null;
  courses: string[];
  skills: string[];
};

export async function accountProfile(client: Awaited<ReturnType<typeof supabase>>, profile?: SignupProfileInput) {
  const { data, error } = await client.rpc("teamup_signup_profile", profile ? { profile } : {});
  return { data: data as AccountProfile | null, error };
}
