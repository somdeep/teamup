import assert from "node:assert/strict";
import test from "node:test";
import { canCancelInvitation } from "../lib/teacher-data";
import { isOpenEvent, readTeacherEvent } from "../lib/teacher-event";

const now = Date.parse("2026-11-14T00:00:00Z");

function eventForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    eventId: "86231f76-32e7-49ec-b11f-e1ba4a2c3401", title: "  Evening Satsang  ", city: "Toronto",
    startsAt: "2027-01-16T18:00", endsAt: "2027-01-16T20:00", timezone: "America/Toronto", volunteers: "3",
  })) form.set(key, value);
  return form;
}

test("validates a priority event and deduplicates canonical skills", () => {
  const form = eventForm();
  form.set("priority", "on");
  form.append("skills", "Photography");
  form.append("skills", "Photography");
  const result = readTeacherEvent(form, now);
  assert.ok("event" in result && result.event);
  assert.equal(result.event.title, "Evening Satsang");
  assert.equal(result.event.category, "priority");
  assert.deepEqual(result.event.required_skills, ["Photography"]);
  assert.equal(result.event.volunteers_needed, 3);
  form.append("skills", "Unknown skill");
  assert.ok("error" in readTeacherEvent(form, now));
});

test("creates a course through the normal event workflow", () => {
  const form = eventForm();
  form.set("eventType", "course");
  const result = readTeacherEvent(form, now);
  if ("error" in result) assert.fail(result.error);
  assert.equal(result.event.category, "course");
});

test("rejects past, reversed and ambiguous local event times", () => {
  const form = eventForm();
  form.set("endsAt", "2027-01-16T17:30");
  assert.ok("error" in readTeacherEvent(form, now));
  assert.ok("error" in readTeacherEvent(eventForm(), Date.parse("2028-01-01T00:00:00Z")));
  form.set("startsAt", "2027-03-14T02:30");
  form.set("endsAt", "2027-03-14T05:00");
  assert.ok("error" in readTeacherEvent(form, now));
});

test("invitation controls are shown only for future scheduled events", () => {
  const future = { starts_at: "2027-01-16T23:00:00Z", status: "scheduled" };
  assert.equal(isOpenEvent(future, now), true);
  assert.equal(isOpenEvent({ ...future, status: "cancelled" }, now), false);
  assert.equal(isOpenEvent(future, Date.parse(future.starts_at)), false);
  assert.equal(isOpenEvent({ ...future, starts_at: null }, now), false);
});

test("teachers can cancel pending and accepted requests but retain declined history", () => {
  assert.equal(canCancelInvitation("pending"), true);
  assert.equal(canCancelInvitation("accepted"), true);
  assert.equal(canCancelInvitation("declined"), false);
});
