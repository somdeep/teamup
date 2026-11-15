import { sevaSkills } from "./signup-profile";
import { isUuid } from "./teacher-event";

export const directoryAvailability = {
  available: "Available",
  limited: "Limited",
  unknown: "Not specified",
} as const;

export type VolunteerAvailability = keyof typeof directoryAvailability;
export type DirectoryFilter = {
  q: string;
  city: string;
  skill: string;
  availability: VolunteerAvailability | "";
  forEvent: string;
  page: number;
};

export function readDirectoryFilter(params: Record<string, string | string[] | undefined>): DirectoryFilter {
  const read = (name: string) => typeof params[name] === "string" ? params[name].trim() : "";
  const skill = read("skill");
  const availability = read("availability");
  const forEvent = read("forEvent");
  return {
    q: (read("q") || read("name")).slice(0, 80),
    city: read("city").slice(0, 80),
    skill: sevaSkills.some(option => option === skill) ? skill : "",
    availability: Object.hasOwn(directoryAvailability, availability) ? availability as VolunteerAvailability : "",
    forEvent: isUuid(forEvent) ? forEvent : "",
    page: Math.min(1000, Math.max(1, Number.parseInt(read("page"), 10) || 1)),
  };
}

export function volunteerDirectoryHref(filter: DirectoryFilter, person?: string) {
  const params = new URLSearchParams({ view: "find" });
  for (const [key, value] of Object.entries(filter)) {
    if (value && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  if (person) params.set("person", person);
  return `/teacher?${params}`;
}

export function volunteerProfileHref(person: string, forEvent?: string) {
  const params = new URLSearchParams({ view: "find", person });
  if (forEvent) params.set("forEvent", forEvent);
  return `/teacher?${params}`;
}
