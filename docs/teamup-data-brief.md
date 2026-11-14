# TeamUp mock data brief

The hackathon demo should show a coordinator finding and inviting a suitable volunteer in under two minutes, then show the volunteer’s response and the impact of completed seva. Use a small, repeatable Supabase seed with **20 volunteers, 3 organizers, and 5 seva opportunities**. The 26 mock CSVs provide historical people, program, and event records. Skills, availability, and TeamUp invitations need sample data.

## Five priority files

| File | Baseline | Use in TeamUp |
| --- | --- | --- |
| `harmony_program_participants.csv` | 9,116 registrations. Of these, 631 are marked `Volunteer` across 600 distinct Harmony contact IDs. | Identify candidate volunteers. Use attendance records as the basis for reach where the data supports it. |
| `_identity_ground_truth.csv` | 29,280 linked source records across 9,970 distinct people. | Resolve duplicate people across source systems. |
| `harmony_program_people.csv` | 847 teacher, co-teacher, organizer, and coordinator assignments. | Use organizer and coordinator assignments to inform demo roles and event relationships. |
| `harmony_programs.csv` | 303 programs. | Join roles to programs and reuse selected titles, dates, and city-level locations. |
| `eventbrite_events.csv` | 400 events. | Draw on selected Canadian events for additional seva examples. |

The 600 contact IDs are unique within the Harmony volunteer registrations. The count of unique people in that group is determined after applying the identity map. Retreat Guru exports are available for later work. [Mock data folder](https://drive.google.com/drive/folders/1-yooay7uG78MIogABDtlx68zXTCY7_ir)

## Demo data and wireframes

| Screen | Data and behavior |
| --- | --- |
| Volunteer profile and directory | Show a fictional display name, city and province, interests, and skills. Let coordinators filter by skill and location. Use a small skill list such as photography, food service, registration, transportation, and event setup. |
| Availability and matching | Seed editable weekly time slots and a time zone for each volunteer. Require coverage of the full seva time, rank eligible volunteers by skill overlap, and use city as a tie-breaker. Show the reason for each match. |
| Opportunity and invitations | Give each opportunity an organizer, start and end time, city, required skills, and number of volunteers needed. Seed pending, accepted, and declined invitations. Keep one invitation per volunteer and opportunity. Historical registrations describe program participation. |
| Impact | Sum logged contribution minutes for completed service and show distinct events supported. Count people reached once per event. Label totals across events as attendances when repeat participants may be counted, and label schedule-derived hours as estimates. |

## Proposed Supabase model

| Records | Minimum fields or constraints |
| --- | --- |
| Profiles and skills | One profile per canonical person. Store role, fictional display name, city and province, skill tags, and interests. |
| Source mappings | Link TeamUp profiles and opportunities to restricted source references keyed by system, entity type, and source ID. Keep the key unique and separate from directory views. |
| Availability | Volunteer, weekday, start and end time, and time zone. Validate each time window. |
| Opportunities | Organizer, title, city, start and end, event time zone, required skills, volunteer count, and completed-event reach. |
| Invitations | Unique opportunity and volunteer pair, response status, and logged contribution minutes. |

## Import and validation

1. **Identify and deduplicate.** Filter Harmony rows by `participant_type = Volunteer`. Join the source IDs to the identity map, report missing or conflicting mappings, and select 20 distinct mapped people using a stable rule.
2. **Prepare only the fields the app needs.** Normalize city and province, assign fictional names and synthetic skills and availability, and preserve relevant source IDs. Exclude raw CSVs, private contact details, street addresses, birth dates, health and dietary data, payment details, emergency contacts, and agreement records from app tables and public demos.
3. **Seed and rerun.** Load profiles, organizers, opportunities, and invitation records into a dedicated demo environment. Upsert by stable keys in a transaction. Check that a second run preserves the record IDs and counts and creates zero duplicates.
4. **Validate the numbers and the flow.** Reconcile the source baselines and confirm the 20, 3, and 5 demo counts. Check references, time zones, invitation uniqueness, and the field allowlist. Test matching across time zones, send an invitation, exercise accept and decline, and verify the organizer’s status view. Reconcile the impact totals against completed demo records.
