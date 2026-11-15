import assert from "node:assert/strict";
import test from "node:test";
import { combineFetchMatches } from "../lib/fetch/matching";
import type { ExactMatchRow, FetchIntent, PreferenceMatchRow } from "../lib/fetch/types";

const intent: FetchIntent = {
  raw: "Find singers", eventId: "event", eventTitle: "Satsang", skills: ["Music & bhajans"],
  quantity: null, urgentOnly: false, skillSource: "query", clarification: null,
};

const exact: ExactMatchRow = {
  person_id: "one", full_name: "Exact Volunteer", city: "Toronto", skills: ["Music & bhajans"],
  matched_skills: ["Music & bhajans"], available: true, same_city: true, score: 90,
  reasons: ["Open to last-minute seva"], invitation_status: null,
};

const preference: PreferenceMatchRow = {
  person_id: "two", full_name: "Preference Volunteer", city: "Toronto", skills: ["Music & bhajans"],
  matched_skills: ["Music & bhajans"], same_city: true, emergency_seva: false,
  reasons: ["Free on weekends"], invitation_status: null,
};

test("keeps full scheduled coverage distinct from general preferences", () => {
  const results = combineFetchMatches([exact], [preference], intent);
  assert.deepEqual(results.map(result => result.availability), ["full-event", "general-preference"]);
  assert.match(results[0].reasons.join(" "), /covers the full event/);
  assert.match(results[1].reasons.join(" "), /confirm before inviting/);
});

test("deduplicates volunteers and keeps the stronger availability evidence", () => {
  const duplicate = { ...preference, person_id: exact.person_id, full_name: exact.full_name };
  const results = combineFetchMatches([exact], [duplicate], intent);
  assert.equal(results.length, 1);
  assert.equal(results[0].availability, "full-event");
});

test("filters by approved skill and urgent-seva preference", () => {
  const urgentIntent = { ...intent, urgentOnly: true };
  const results = combineFetchMatches([exact], [preference], urgentIntent);
  assert.deepEqual(results.map(result => result.personId), ["one"]);
});
