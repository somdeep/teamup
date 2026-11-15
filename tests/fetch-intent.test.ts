import assert from "node:assert/strict";
import test from "node:test";
import { parseFetchIntent } from "../lib/fetch/intent";
import type { FetchEvent } from "../lib/fetch/types";

const events: FetchEvent[] = [
  {
    id: "86231f76-32e7-49ec-b11f-e1ba4a2c3401", title: "Evening Satsang", city: "Toronto",
    starts_at: "2027-01-16T23:00:00Z", timezone: "America/Toronto", required_skills: ["Music & bhajans", "Photography"],
    volunteers_needed: 5, invitations: [], can_manage: true,
  },
  {
    id: "9d620663-d0b1-41af-a3c0-5c80c24541d5", title: "Community Seva Day", city: "Ottawa",
    starts_at: "2027-01-20T16:00:00Z", timezone: "America/Toronto", required_skills: ["Community Outreach"],
    volunteers_needed: 4, invitations: [], can_manage: true,
  },
];

test("maps natural language skills, quantity, and event context", () => {
  const intent = parseFetchIntent("Find 3 singers for Satsang", events, events[1].id);
  assert.equal(intent.eventId, events[0].id);
  assert.equal(intent.quantity, 3);
  assert.deepEqual(intent.skills, ["Music & bhajans"]);
  assert.equal(intent.clarification, null);
});

test("uses the selected event but asks when its skill is ambiguous", () => {
  const intent = parseFetchIntent("Find some helpers", events, events[0].id);
  assert.equal(intent.eventId, events[0].id);
  assert.match(intent.clarification ?? "", /Which skill/);
});

test("can use the single approved skill saved on an event", () => {
  const intent = parseFetchIntent("Find two volunteers", events, events[1].id);
  assert.equal(intent.skillSource, "event");
  assert.deepEqual(intent.skills, ["Community Outreach"]);
  assert.equal(intent.quantity, 2);
});

test("recognizes supported non-English skill aliases without a language selector", () => {
  assert.deepEqual(parseFetchIntent("मुझे दो गायक चाहिए", events, events[0].id).skills, ["Music & bhajans"]);
  assert.deepEqual(parseFetchIntent("ਮੈਨੂੰ ਫੋਟੋਗ੍ਰਾਫਰ ਚਾਹੀਦਾ ਹੈ", events, events[0].id).skills, ["Photography"]);
});
