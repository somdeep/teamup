import assert from "node:assert/strict";
import test from "node:test";
import { readDirectoryFilter, volunteerDirectoryHref } from "../lib/volunteer-directory";

const eventId = "d7db6319-b3e5-471c-97ee-eff31520942b";
const personId = "5c2fe275-7496-48c3-a907-1e8868cf77f9";

test("directory links preserve filters and event selection when opening a profile", () => {
  const filter = readDirectoryFilter({
    name: " Photography ", city: " Montréal ", skill: "Tech & AV", availability: "limited",
    forEvent: eventId, page: "2",
  });
  const profile = new URL(volunteerDirectoryHref(filter, personId), "http://localhost");
  assert.equal(profile.pathname, "/teacher");
  assert.deepEqual(Object.fromEntries(profile.searchParams), {
    view: "find", q: "Photography", city: "Montréal", skill: "Tech & AV", availability: "limited",
    forEvent: eventId, page: "2", person: personId,
  });
});

test("directory ignores unsupported filters and normalizes page and search limits", () => {
  const filter = readDirectoryFilter({
    q: "a".repeat(90), city: ["Toronto", "Ottawa"], skill: "unknown", availability: "__proto__",
    forEvent: "bad-id", page: "-2",
  });
  assert.deepEqual(filter, { q: "a".repeat(80), city: "", skill: "", availability: "", forEvent: "", page: 1 });
  assert.equal(volunteerDirectoryHref(readDirectoryFilter({})), "/teacher?view=find");
});
