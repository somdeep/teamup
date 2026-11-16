import { fetchIntentJsonSchema, validateLlmFetchIntent } from "../../../lib/fetch/llm-intent";
import type { FetchEvent, FetchIntent } from "../../../lib/fetch/types";
import { approvedFetchSkills } from "../../../lib/fetch/intent";

type ResponsesPayload = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
};

type OpenAiErrorPayload = {
  error?: { code?: string | null; type?: string; message?: string };
};

export type OpenAiInterpretation =
  | { ok: true; intent: FetchIntent }
  | { ok: false; error: string };

function responseText(payload: ResponsesPayload) {
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "refusal") return { refusal: content.refusal ?? "The model declined the request." };
      if (content.type === "output_text" && content.text) return { text: content.text };
    }
  }
  return {};
}

export async function interpretWithOpenAi(
  raw: string,
  events: FetchEvent[],
  selectedEventId?: string,
): Promise<OpenAiInterpretation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI interpretation is not configured locally." };

  const model = process.env.FETCH_OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const safeEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    city: event.city,
    startsAt: event.starts_at,
    timezone: event.timezone,
    requiredSkills: event.required_skills,
  }));

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        temperature: 0,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You interpret short staffing requests for TeamUp's Fetch assistant.",
                  "Return exactly one manageable event, one approved canonical skill, and an optional quantity from 1 to 20.",
                  "Use only the supplied event IDs and approved skills. Never invent a value.",
                  "The selected event is context, but explicit event wording takes precedence.",
                  "Map ordinary phrases such as singers, kirtan, or vocalists to the closest supplied canonical skill.",
                  "When the event or skill is genuinely ambiguous, set the unresolved field to null and ask one concise clarification question.",
                  "Do not answer as a chatbot and do not make volunteer or availability claims.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  request: raw.trim().slice(0, 350),
                  selectedEventId: selectedEventId || null,
                  approvedSkills: approvedFetchSkills(),
                  manageableEvents: safeEvents,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "fetch_intent",
            strict: true,
            schema: fetchIntentJsonSchema(),
          },
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { ok: false, error: "The AI interpreter could not be reached." };
  }

  if (!response.ok) {
    let providerError: OpenAiErrorPayload = {};
    try {
      providerError = await response.json() as OpenAiErrorPayload;
    } catch {
      // Keep the status-only message when the provider did not return JSON.
    }
    const code = providerError.error?.code || providerError.error?.type;
    if (response.status === 401) return { ok: false, error: "The AI key was rejected by the provider." };
    if (response.status === 429) {
      const quotaCodes = new Set([
        "insufficient_quota",
        "credit_balance_exhausted",
        "organization_usage_limit_exceeded",
        "organization_spend_limit_exceeded",
        "project_spend_limit_exceeded",
      ]);
      return {
        ok: false,
        error: code && quotaCodes.has(code)
          ? "The AI provider account has no available quota."
          : "The AI provider is rate-limiting requests right now.",
      };
    }
    return { ok: false, error: `The AI interpreter returned an error (${response.status}${code ? `, ${code}` : ""}).` };
  }

  const payload = await response.json() as ResponsesPayload;
  if (payload.status === "incomplete") {
    return { ok: false, error: `The AI interpretation was incomplete${payload.incomplete_details?.reason ? `: ${payload.incomplete_details.reason}` : "."}` };
  }
  const content = responseText(payload);
  if (content.refusal) return { ok: false, error: "The AI interpreter declined this request." };
  if (!content.text) return { ok: false, error: "The AI interpreter returned no usable result." };

  let decoded: unknown;
  try {
    decoded = JSON.parse(content.text);
  } catch {
    return { ok: false, error: "The AI interpreter returned malformed data." };
  }
  return validateLlmFetchIntent(decoded, raw, events);
}
