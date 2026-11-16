import assert from "node:assert/strict";
import test from "node:test";
import { fetchIntentJsonSchema, validateLlmFetchIntent } from "../lib/fetch/llm-intent";
import type { FetchEvent } from "../lib/fetch/types";

const event: FetchEvent = {
  id: "86231f76-32e7-49ec-b11f-e1ba4a2c3401",
  title: "Evening Satsang",
  city: "Toronto",
  starts_at: "2027-01-16T23:00:00Z",
  timezone: "America/Toronto",
  required_skills: ["Music & bhajans"],
  volunteers_needed: 5,
  invitations: [],
  can_manage: true,
};

test("accepts a structured AI interpretation using supplied allow-lists", () => {
  const result = validateLlmFetchIntent({
    eventId: event.id,
    skill: "Music & bhajans",
    quantity: 3,
    urgentOnly: false,
    clarification: null,
    explanation: "Three music volunteers for Evening Satsang",
  }, "Find 3 singers for Satsang", [event]);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.intent.eventId, event.id);
    assert.deepEqual(result.intent.skills, ["Music & bhajans"]);
    assert.equal(result.intent.quantity, 3);
  }
});

test("rejects event IDs and skills outside the supplied allow-lists", () => {
  const badEvent = validateLlmFetchIntent({
    eventId: "11111111-1111-1111-1111-111111111111",
    skill: "Music & bhajans",
    quantity: 2,
    urgentOnly: false,
    clarification: null,
    explanation: "",
  }, "Find singers", [event]);
  assert.equal(badEvent.ok, false);

  const badSkill = validateLlmFetchIntent({
    eventId: event.id,
    skill: "Expert dog walking",
    quantity: 2,
    urgentOnly: false,
    clarification: null,
    explanation: "",
  }, "Find dog walkers", [event]);
  assert.equal(badSkill.ok, false);
});

test("allows a concise clarification without guessing an event or skill", () => {
  const result = validateLlmFetchIntent({
    eventId: null,
    skill: null,
    quantity: null,
    urgentOnly: false,
    clarification: "Which event and skill should I use?",
    explanation: "The request is ambiguous.",
  }, "Find helpers", [event]);
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.intent.clarification ?? "", /Which event/);
});

test("the structured-output schema forbids extra model fields", () => {
  const schema = fetchIntentJsonSchema();
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["eventId", "skill", "quantity", "urgentOnly", "clarification", "explanation"]);
});
