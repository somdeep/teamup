# TeamUp future scope

## Volunteer event creation

Let a signed-in Volunteer create a seva event from the volunteer experience. Reuse the event form, schedule and staffing fields. Record the volunteer who created it and give them the Organizer assignment for that event.

Give the volunteer event-scoped controls for managing their event. Before implementation, decide whether a volunteer can publish and invite directly or sends the event to a Teacher for review. The volunteer keeps their Volunteer account role in either flow. Test creation, editing, and invitations on their event, along with access to events other people manage.

## Member accounts

Add a Member signup and landing experience after the Teacher and Volunteer flows are complete. Define what a Member can do beyond maintaining a basic profile, then expose Member as a signup choice and route Member logins to that experience. Existing database support for the Member role remains in place during V1, but new users can only choose Teacher or Volunteer.

## Teachers who also volunteer

Let a Teacher opt into volunteering without changing their primary Teacher account role or Teacher Portal landing page. Add an **Also available to volunteer** account setting that creates or updates the linked `volunteer_profiles` record, marks the person as a volunteer, and collects their skills, interests, availability, and emergency-seva preference.

Dual-participation Teachers should appear in the volunteer directory for other Teachers and be able to receive, accept, and decline event invitations. Keep the current self-exclusion in invitation searches so a Teacher cannot invite themselves; provide a separate way to preview their own volunteer profile. After a Teacher opts into volunteering, expose a clearly named **My Volunteer Invitations** view alongside their outgoing **Sent Requests**. Until this dual-role experience exists, keep the incoming Invitations page hidden from Teacher accounts.

## Social integrations

Let people optionally add verified or clearly labeled profile links for Facebook, Instagram, YouTube, and other approved community channels. Keep every social field optional, validate URLs against an allowlist of supported domains, and let each person control whether a link is visible to Teachers, event-circle members, or nobody.

Add simple event-sharing actions that create a safe public summary for social platforms without exposing volunteer names, phone numbers, private event-circle messages, or invitation data. Treat direct publishing as a later phase: use each platform’s supported OAuth flow, request the minimum permissions, store tokens securely outside public profile data, support revocation, and never collect social-media passwords.

## Opportunity and program integrations

### Facebook fundraisers

Allow a seva event or impact campaign to link to an official Facebook fundraiser. Show the fundraiser as an external call to action rather than copying donation or payment details into TeamUp. Validate the destination, clearly indicate that it opens Facebook, and keep fundraising participation separate from volunteer attendance and impact hours. Explore fundraiser progress syncing only through a supported Meta API and approved permissions.

### Calling seva

Represent calling seva as a campaign or event with a purpose, schedule, coordinator, required number of callers, and optional script or talking points. Let volunteers accept calling shifts and record completed time or outcomes without exposing private contact lists in general event details. Add consent, access controls, audit history, and data-retention rules before importing phone lists or call results.

### Courses as events

Treat Art of Living courses and programs as event opportunities when they need Teachers, coordinators, registration help, hospitality, setup, or other seva. Preserve Harmony or Retreat Guru source IDs, course type, schedule, venue, and event-scoped roles. Avoid duplicating a course that already exists in a connected source, and keep course participation separate from volunteering unless a person has an explicit seva assignment.

### Corporate social responsibility

Support CSR opportunities for corporate volunteer teams while preserving the same person-level consent and privacy controls. Add optional organization affiliation, team registration, company-supported opportunities, capacity limits, verified hours, and aggregate impact reports. Do not expose individual volunteer activity to an employer without clear consent; prefer organization-level totals for hours, events supported, and people reached.
