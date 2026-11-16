import { sevaSkills } from "../signup-profile";
import type { FetchEvent, FetchIntent } from "./types";

export type LlmFetchIntent = {
  eventId: string | null;
  skill: string | null;
  quantity: number | null;
  urgentOnly: boolean;
  clarification: string | null;
  explanation: string;
};

export type LlmIntentValidation =
  | { ok: true; intent: FetchIntent }
  | { ok: false; error: string };

function shortText(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length <= maximum ? value.trim() : null;
}

export function validateLlmFetchIntent(
  value: unknown,
  raw: string,
  events: FetchEvent[],
): LlmIntentValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "The AI response was not a valid Fetch interpretation." };
  }

  const candidate = value as Partial<LlmFetchIntent>;
  const eventId = candidate.eventId === null ? null : shortText(candidate.eventId, 80);
  const skill = candidate.skill === null ? null : shortText(candidate.skill, 80);
  const clarification = candidate.clarification === null ? null : shortText(candidate.clarification, 180);
  const event = events.find(option => option.id === eventId) ?? null;
  const quantity = candidate.quantity;

  if (candidate.eventId !== null && !event) {
    return { ok: false, error: "The AI selected an event outside your manageable events." };
  }
  if (candidate.skill !== null && (!skill || !sevaSkills.some(option => option === skill))) {
    return { ok: false, error: "The AI selected a skill outside TeamUp’s approved skills." };
  }
  if (quantity !== null && (!Number.isInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 20)) {
    return { ok: false, error: "The AI selected an invalid volunteer quantity." };
  }
  if (typeof candidate.urgentOnly !== "boolean") {
    return { ok: false, error: "The AI returned an invalid urgency value." };
  }
  if (candidate.clarification !== null && !clarification) {
    return { ok: false, error: "The AI returned an invalid clarification." };
  }
  if (!clarification && (!event || !skill)) {
    return { ok: false, error: "The AI interpretation is missing an event or skill." };
  }

  return {
    ok: true,
    intent: {
      raw: raw.trim().slice(0, 350),
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? null,
      skills: skill ? [skill] : [],
      quantity: quantity === null ? null : Number(quantity),
      urgentOnly: candidate.urgentOnly,
      skillSource: skill ? "query" : null,
      clarification,
    },
  };
}

export function fetchIntentJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["eventId", "skill", "quantity", "urgentOnly", "clarification", "explanation"],
    properties: {
      eventId: { type: ["string", "null"] },
      skill: {
        anyOf: [
          { type: "string", enum: [...sevaSkills] },
          { type: "null" },
        ],
      },
      quantity: { type: ["integer", "null"] },
      urgentOnly: { type: "boolean" },
      clarification: { type: ["string", "null"] },
      explanation: { type: "string" },
    },
  } as const;
}
