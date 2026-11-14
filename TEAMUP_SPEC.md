# TeamUp — MVP Product & Build Specification

**Tagline:** Together in Seva  
**Version:** Hackathon draft · November 14, 2026

## Product goal
Help Art of Living organizers find, invite, and coordinate volunteers for seva opportunities. An organizer should be able to find and invite suitable volunteers in under two minutes.

## Roles
- **Volunteer:** manages personal profile, skills, location, weekly availability and responses to invitations.
- **Organizer / teacher:** creates events, searches and matches volunteers, sends invitations and tracks responses.

## Five MVP features
1. **Volunteer profiles:** account, display name, city/area, controlled skill tags, optional interests and editable details. Private contact information should not be visible broadly.
2. **Skill-based search:** organizer filters by skills and location; results are read from stored volunteer profiles.
3. **Availability:** volunteers maintain weekday and time-slot availability. Account for time zones when evaluating events.
4. **Events and matching:** organizers enter event title, description, location, start/end, required skills and volunteer count. Show eligible, explainable matches using deterministic rules, not AI.
5. **Invitations:** organizers invite volunteers; volunteers accept or decline; organizers see pending/accepted/declined statuses. Prevent duplicate event-volunteer invitations.

## Essential flows
**Volunteer:** Sign in → create/edit profile → choose skills → set availability → view invitation → accept/decline.

**Organizer:** Sign in → create event → specify needs → view matching volunteers → invite → see response status.

## Six screens
1. [Landing page](docs/landing-page.md), sign-in, and role-aware navigation
2. Volunteer profile
3. Weekly availability editor
4. Event creation form
5. Volunteer search and match results
6. Invitations and response tracking

Design mobile-first; use friendly plain language, readable typography, warm neutrals and subtle saffron accents. Ensure accessible forms and buttons.

## Recommended stack
- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Auth, PostgreSQL and Row Level Security
- GitHub for repository; Vercel for hosting

## Minimum data model
- `profiles`: `id`, `display_name`, `role`, `city_area`, `created_at` (email managed by Auth)
- `volunteer_profiles`: `user_id`, `skills`, `interests`
- `availability`: `id`, `volunteer_id`, `day_of_week`, `start_time`, `end_time`, `timezone`
- `events`: `id`, `organizer_id`, `title`, `description`, `location`, `starts_at`, `ends_at`, `required_skills`, `volunteers_needed`, `created_at`
- `invitations`: `id`, `event_id`, `volunteer_id`, `status`, `invited_at`, `responded_at`; unique pair `(event_id, volunteer_id)`

## Matching version 1
First restrict matches to volunteers available at the event time, then prioritize skill overlap and location. Show the reason for each suggestion and allow organizers to choose manually. An illustrative weighting for later iteration is skills 50%, availability 35%, location 15%, but availability should be an eligibility check rather than only a score. Do not infer travel distances without sufficient data.

## Security and data quality
- Authenticate users; restrict operations by role and resource ownership.
- Apply Supabase RLS to all relevant tables.
- Volunteers edit only their own profiles, availability and invitation responses.
- Organizers manage only their own events and related invitations.
- Do not expose private contacts in public search; validate all writes server-side.
- Handle loading, empty, validation and error states; respect event time zones.
- Use fictional volunteers in the demo.

## Out of scope
AI matching, WhatsApp/SMS/email automation, third-party calendar sync, payment processing, native mobile apps, advanced analytics and reputation systems.

## Implementation sequence
1. Initialize GitHub repository, Next.js app, `.env.example`, README, Supabase schema and auth/role authorization.
2. Build volunteer profiles and availability; test persistence.
3. Build event creation and search/matching; test filters and eligibility.
4. Add invitations, response updates and organizer status view; test permissions and duplicates.
5. Deploy to Vercel, configure Supabase Auth redirects and environment variables, verify RLS and rehearse mobile demo.

## Acceptance demo
Seed 10–20 fictional volunteers. Sign in as an organizer, create a photography event, find available skill matches, and invite three people. Sign in as a volunteer, accept/decline an invite, return to the organizer dashboard and verify persisted results. Test unauthorized access is denied and confirm deployment on a phone.

## Working instructions for Codex
Read this specification before making major changes. Propose and implement small testable increments. Run lint, type checking, tests and production build; explicitly state what passed and what remains blocked. Keep README and setup instructions current. Never commit secrets. Place a short `AGENTS.md` in the repository that points here.

## Open decisions
Confirm initial skill list and location options, how organizer privileges are approved, and whether one-off availability exceptions are needed. Prefer the simplest hackathon-safe defaults and record decisions.
