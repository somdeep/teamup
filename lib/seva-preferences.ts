import { sevaSkills, type SignupProfileInput } from "./signup-profile";

export const availabilityOptions = ["Weekdays", "Weekends", "Evenings", "Flexible", "Specific Dates"] as const;
export const maxSpecificDates = 20;
export const maxPhotoBytes = 192 * 1024;

export type SevaPreferences = {
  intent: SignupProfileInput["signup_intent"];
  skills: string[];
  interests: string[];
  availability: string[];
  dates: string[];
  emergency: boolean;
};

export type SevaProfile = SevaPreferences & { complete: boolean; has_photo: boolean };
export type SevaSkills = Pick<SevaPreferences, "skills" | "interests">;
export type SevaAvailability = Pick<SevaPreferences, "availability" | "dates" | "emergency">;

function choices(form: FormData, name: string, allowed: readonly string[]) {
  const values = [...new Set(form.getAll(name))];
  const valid = values.filter((value): value is string => typeof value === "string" && allowed.includes(value));
  return values.length === valid.length ? valid : null;
}

export function readSevaSkills(form: FormData): SevaSkills | null {
  const skills = choices(form, "skills", sevaSkills);
  const interests = choices(form, "interests", sevaSkills);
  return skills && interests ? { skills, interests } : null;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function readSevaAvailability(form: FormData): { preferences: SevaAvailability } | { error: string } {
  const availability = choices(form, "availability", availabilityOptions);
  if (!availability) return { error: "Choose availability from the list." };

  const dates = availability.includes("Specific Dates") ? [...new Set(form.getAll("dates"))] : [];
  if (availability.includes("Specific Dates") && (!dates.length || dates.length > maxSpecificDates || !dates.every(isDate))) {
    return { error: `Enter between 1 and ${maxSpecificDates} valid dates.` };
  }

  return { preferences: { availability, dates: dates.filter(isDate).sort(), emergency: form.get("emergency") === "on" } };
}

export function readSevaPreferences(form: FormData): { preferences: SevaPreferences } | { error: string } {
  const intent = form.get("role");
  if (intent !== "Volunteer" && intent !== "Teacher") return { error: "Choose Teacher or Volunteer." };

  const skillSelections = readSevaSkills(form);
  if (!skillSelections) return { error: "Choose skills and learning interests from the list." };
  const availability = readSevaAvailability(form);
  if ("error" in availability) return availability;

  return { preferences: { intent, ...skillSelections, ...availability.preferences } };
}
