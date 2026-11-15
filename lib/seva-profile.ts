import type { SevaAvailability, SevaPreferences, SevaProfile, SevaSkills } from "./seva-preferences";
import type { supabase } from "./supabase";

export async function sevaProfile(client: Awaited<ReturnType<typeof supabase>>, input?: {
  preferences: SevaPreferences;
  photo?: string;
  removePhoto: boolean;
}) {
  const { data, error } = await client.rpc(input ? "teamup_complete_seva_profile" : "teamup_seva_profile", input ? {
    preferences: input.preferences,
    ...(input.photo ? { photo_base64: input.photo } : {}),
    remove_photo: input.removePhoto,
  } : {});
  return { data: data as SevaProfile | null, error };
}

export async function sevaSkillsProfile(client: Awaited<ReturnType<typeof supabase>>, selections?: SevaSkills) {
  const { data, error } = await client.rpc("teamup_skills_profile", selections ?? {});
  return { data: data as (SevaProfile & { skills_reviewed: boolean }) | null, error };
}

export async function sevaAvailabilityProfile(client: Awaited<ReturnType<typeof supabase>>, preferences?: SevaAvailability) {
  const { data, error } = await client.rpc("teamup_availability_profile", preferences ? { availability_preferences: preferences } : {});
  return { data: data as (SevaProfile & { skills_reviewed: boolean; availability_reviewed: boolean }) | null, error };
}
