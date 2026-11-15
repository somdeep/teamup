import { Temporal } from "@js-temporal/polyfill";
import { readText } from "./auth-input";
import { sevaSkills } from "./signup-profile";

export const eventTimeZones = [
  ["America/Vancouver", "Pacific"], ["America/Edmonton", "Mountain"], ["America/Regina", "Saskatchewan"],
  ["America/Winnipeg", "Central"], ["America/Toronto", "Eastern"], ["America/Halifax", "Atlantic"],
  ["America/St_Johns", "Newfoundland"],
] as const;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function readTeacherEvent(form: FormData, now = Date.now()) {
  const id = form.get("eventId");
  const title = readText(form, "title").trim();
  const city = readText(form, "city").trim();
  const venue = readText(form, "venue").trim();
  const description = readText(form, "description").trim();
  const start = readText(form, "startsAt");
  const end = readText(form, "endsAt");
  const timezone = readText(form, "timezone");
  const volunteers = readText(form, "volunteers");
  const eventType = readText(form, "eventType");
  const skills = [...new Set(form.getAll("skills"))];
  const validSkills = skills.filter((skill): skill is string => sevaSkills.some(option => option === skill));

  if (!isUuid(id)) return { error: "Refresh the event form and try again." } as const;
  if (!title || title.length > 120 || !city || city.length > 100 || venue.length > 120 || description.length > 1000) {
    return { error: "Enter an event name and city, and check the field lengths." } as const;
  }
  if (!/^\d{1,4}$/.test(volunteers) || Number(volunteers) < 1 || Number(volunteers) > 1000) {
    return { error: "Enter between 1 and 1,000 volunteers." } as const;
  }
  if (validSkills.length !== skills.length) return { error: "Choose required skills from the list." } as const;
  if (!eventTimeZones.some(([zone]) => zone === timezone)) return { error: "Choose the event time zone." } as const;
  if (eventType && eventType !== "event" && eventType !== "course") return { error: "Choose a valid event type." } as const;

  const localTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!localTime.test(start) || !localTime.test(end)) return { error: "Enter a start and end date and time." } as const;
  try {
    const startAt = Temporal.PlainDateTime.from(start).toZonedDateTime(timezone, { disambiguation: "reject" });
    const endAt = Temporal.PlainDateTime.from(end).toZonedDateTime(timezone, { disambiguation: "reject" });
    if (startAt.epochMilliseconds <= now || endAt.epochMilliseconds <= startAt.epochMilliseconds) {
      return { error: "Choose a future start and an end after it." } as const;
    }
  } catch {
    return { error: "Choose valid local times outside an ambiguous daylight saving hour." } as const;
  }

  return { event: {
    id, title, city, venue_name: venue || null, description: description || null,
    starts_local: start, ends_local: end, timezone, required_skills: validSkills,
    volunteers_needed: Number(volunteers), category: form.get("priority") === "on" ? "priority" : eventType === "course" ? "course" : null,
  } } as const;
}

export function isOpenEvent(event: { status: string; starts_at: string | null }, now = Date.now()) {
  return event.status === "scheduled" && !!event.starts_at && Date.parse(event.starts_at) > now;
}

export function formatEventTime(event: { starts_at: string | null; timezone: string }) {
  if (!event.starts_at) return "Time to be confirmed";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium", timeStyle: "short", timeZone: event.timezone,
  }).format(new Date(event.starts_at));
}
