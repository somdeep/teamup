# Fetch Assistant

Fetch is TeamUp's friendly animated dog assistant for teachers. It is embedded in the existing Teacher Portal rather than operating as a separate chatbot, dashboard, or login.

The current implementation is documented here. The proposed LLM evolution, requested-skill matching change, rollout stages, and trade-off decisions are maintained separately in [Fetch LLM Integration Plan](fetch-llm-integration-plan.md).

## Hackathon AI slice

Fetch now has an optional server-side AI interpretation path for the hackathon demo. It uses the OpenAI Responses API with strict structured output to interpret exactly one manageable event, one canonical TeamUp skill, and one requested quantity. The result is checked again against the teacher's server-loaded event IDs, the `sevaSkills` allow-list, and the 1–20 quantity limit before it can reach matching.

The model receives only the teacher's short request, a minimized list of manageable events, the selected event ID, and approved skill labels. It never receives volunteer names, profiles, contact details, availability, invitations, credentials, or session tokens. Supabase still performs matching and authorization, and the existing explicit review remains the only route to sending invitations.

Configuration is server-only:

```dotenv
OPENAI_API_KEY=your-server-side-key
FETCH_OPENAI_MODEL=gpt-4o-mini
FETCH_INTERPRETATION_MODE=ai-first
```

`FETCH_INTERPRETATION_MODE=deterministic` is the instant rollback. If the AI call times out, is refused, returns malformed data, or fails validation, Fetch displays a useful fallback notice and runs the deterministic parser. An AI failure is never displayed as an empty volunteer result.

AI usage is capped globally at 50 interpretation calls per UTC hour. The authenticated server action atomically claims a slot through `teamup_claim_fetch_llm_request` before contacting OpenAI. The counter is shared across teachers and application instances, so it remains effective across hosted server instances. When the limit is reached—or when the guard itself is unavailable—Fetch does not call the provider and safely uses deterministic interpretation.

For local-only testing before that migration is applied, development mode uses a process-local 50-per-hour counter. It resets when the dev server restarts and is intentionally never used in production.

## Current implementation

The local implementation adds:

- An orange **Ask Fetch** tile in the Teacher Portal and a persistent floating dog launcher on that page.
- The prototype's original idle, playful, searching, digging, no-results, sleeping, and zen video assets, extracted into `public/fetch/`.
- A mobile-first assistant panel that preserves the prototype's teal/orange design, large animated dog, short prompt suggestions, results below the dog, and optional voice input.
- Structured AI interpretation for one event, one approved skill, and one quantity when configured, with deterministic natural-language parsing as the rollback and failure fallback.
- Clarification messages when Fetch cannot identify a skill or event instead of silently guessing.
- Authenticated searches using the current teacher session and existing Supabase matching functions.
- Separate labels for full scheduled availability and general availability preferences.
- Manual volunteer selection followed by an explicit invitation review and confirmation step.
- Invitations sent through the existing `teamup_invite` RPC, with event-management authorization rechecked on the server.
- Loading, empty-results, clarification, error, invitation-review, and success states.
- Unit coverage for intent parsing and availability-result merging.

One additive database migration provides the global AI request counter. It stores aggregate hourly counts only—never prompts, model output, volunteer data, or teacher identity. No separate login or fictional production data was added.

## User journey

1. A signed-in, approved teacher completes onboarding and arrives at `/teacher`.
2. The teacher opens Fetch from the orange portal tile or floating dog.
3. The teacher chooses an upcoming event they can manage.
4. They type or speak a request such as `Find 3 singers for Satsang`.
5. Fetch shows how it interpreted the request before displaying real volunteer matches.
6. Results state whether availability covers the full scheduled event or comes from a general preference.
7. The teacher selects volunteers and taps **Review invitations**.
8. A separate confirmation block names the event and volunteers and explains that invitations are pending requests.
9. Only **Confirm and send** invokes the backend invitation function.
10. A volunteer is never described as confirmed unless the existing invitation status is `accepted`.

## Architecture

### Client UI

`app/teacher/fetch/fetch-assistant.tsx` owns the panel, animations, voice-input enhancement, interpretation display, result selection, and confirmation UI. It receives only the teacher's upcoming `can_manage` events from the server-rendered Teacher Portal.

`app/teacher/fetch/fetch-assistant.module.css` contains the isolated visual system so the rest of TeamUp's pages and components remain unchanged.

### Intent interpretation

`app/teacher/fetch/openai-intent.ts` calls the provider from the server only. `lib/fetch/llm-intent.ts` owns the strict schema and the second allow-list validation pass. The authenticated action in `app/teacher/fetch/actions.ts` loads manageable upcoming events itself; it does not trust a client-supplied event catalog.

`lib/fetch/intent.ts` remains the deterministic fallback. It maps common English phrases and a small set of Hindi and Punjabi phrases to the canonical skills in `sevaSkills`. There is intentionally no language selector. The parser:

- recognizes quantities from 1–20;
- resolves a unique event from its title or significant title tokens;
- falls back to the event currently selected by the teacher;
- uses the event's saved skill only when there is exactly one required skill;
- asks for clarification when event or skill context remains ambiguous; and
- recognizes urgent or last-minute requests without changing event timing.

This fallback is explainable, fast, testable, and does not send personal data to an external AI service.

### Matching and availability

`app/teacher/fetch/actions.ts` starts every operation with `teacherSession()`. It reloads the requested event through `teamup_teacher_events` and requires `can_manage` plus an upcoming scheduled event.

Search merges:

- `match_volunteers(..., p_include_unavailable: false)` for full scheduled coverage; and
- `recommend_volunteers(...)` for general availability preferences.

`lib/fetch/matching.ts` deduplicates the two result sets, gives stronger evidence precedence, applies the interpreted approved skills, and labels general preference matches conservatively. Results expose no email, phone, financial, health, or emergency-contact data.

The current `recommend_volunteers` RPC is optimized around an event's saved required skills. If a teacher asks for an additional skill not saved on the event, full scheduled matches can still be found by `match_volunteers`, but general-preference matches for that additional skill may be incomplete. Fetch does not fabricate missing matches.

### Safe invitations

The server validates UUIDs, limits a request to 20 volunteers, reloads the event and its invitations, and prevents sending more new invitations than the remaining volunteer need after accepted and pending requests. Each selected person is then passed to `teamup_invite`, which retains the database's own event ownership, volunteer-profile, self-invite, event-status, and duplicate protections.

The UI calls this server action only after a teacher reviews the volunteer names and explicitly confirms.

## Animation behavior

| Fetch state | Asset |
| --- | --- |
| Resting | `dog-idle.mp4` |
| Running a search | `dog-searching.mp4` |
| Checking availability | `dog-digging.mp4` |
| Successful result or invitation | `dog-playful.mp4` |
| No results or clarification needed | `dog-no-results.mp4` |
| Occasional idle reaction | `dog-sleeping.mp4`, `dog-zen.mp4`, `dog-playful.mp4` |

Tapping the dog plays the playful reaction. Idle reactions pause during searches, voice capture, invitation review, and invitation submission. Reduced-motion preferences disable UI motion and idle reactions; videos remain as the primary character artwork.

## Voice and accessibility

Voice input uses the browser's optional Web Speech API. Unsupported browsers and denied microphone permission fall back to the same text field without blocking the workflow. Search is not submitted automatically from partial speech, giving the teacher a chance to review it.

The assistant supports keyboard focus, Escape to close, visible focus styles, live status regions, explicit labels, disabled/busy states, and profile links for each result. The panel is non-modal so the underlying Teacher Portal remains available.

## Testing

Automated tests cover:

- skill synonym mapping;
- quantity extraction;
- event-title resolution;
- clarification for ambiguous skill context;
- selected-event fallback;
- non-English aliases without a language menu;
- full schedule versus general-preference labels;
- deduplication that preserves the stronger availability evidence; and
- urgent-seva filtering.
- AI result validation against manageable events, canonical skills, and quantity bounds;
- safe clarification from structured output; and
- rejection of model-invented events and skills.

Main manual journeys for local testing:

1. Open and close Fetch from both launchers.
2. Tap the dog and wait for an idle reaction.
3. Search by a known skill and selected event.
4. Search by an event name in the sentence.
5. Submit an ambiguous request and verify a clarification appears.
6. Search where no volunteers match.
7. Use voice input in a supported browser and typing in an unsupported browser.
8. Select volunteers, cancel the review, reopen it, then explicitly confirm.
9. Verify sent invitations appear as pending rather than confirmed.
10. Verify the panel at narrow mobile widths and with keyboard-only navigation.

## Future scope and research

Potential later improvements, each requiring a separate product/security decision:

- Add server-side semantic intent classification for more varied phrasing, while retaining canonical skill allow-lists, an interpretation preview, confidence thresholds, and deterministic fallback. Personal volunteer data should not be sent to an external model.
- Add a teacher-approved synonym table managed in TeamUp so community terminology can evolve without a code release.
- Extend matching through a dedicated RPC that accepts an approved requested-skill array. This would make general-preference matching complete when a teacher asks for a skill not already saved on the event. This is a database change and is not part of the current implementation.
- Add event aliases (for example, common short names) as explicit event metadata rather than relying only on title tokens.
- Add Canadian French aliases and broaden transliterated Hindi/Punjabi support after review by community speakers.
- Add result pagination or a dedicated full-results view if real events regularly exceed the current concise assistant list.
- Add invitation batches with an audit record and idempotency key if coordinators need larger campaigns.
- Add analytics using privacy-preserving counts such as clarification rate, successful-search rate, and time-to-invite; do not log raw voice transcripts or personal search results by default.
- Consider prerecorded voice cues or captions for the dog only after an accessibility review; Fetch should never require audio.
- Revisit reduced-motion behavior if static poster frames are preferred over autoplay video for some users.

## Prototype research notes

The supplied `teamup-fetch-v6-friendly-dog.html` was treated as a visual and interaction prototype, not executable production code. The reusable implementation keeps its strongest ideas—floating avatar, large dog-first panel, teal/orange styling, short suggestions, results directly beneath the dog, tap-to-play, idle reactions, and optional microphone—while removing:

- fictional volunteers and demo events;
- in-browser Supabase URL/key/password fields;
- standalone authentication;
- hard-coded production links;
- simulated invitation mutations;
- language tabs; and
- direct REST calls from embedded JavaScript.

The production integration instead uses the app's current Next.js session, server actions, Supabase client, RLS, and authorization RPCs.
