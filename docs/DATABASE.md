# TeamUp Database: How We Built It

Nov 14, 2026

This is a record of how we set up TeamUp's database for the #BuildForGood hackathon: where the data came from, what we built in Supabase, and how we keep volunteer information private. Anyone on the team should be able to pick it up, rerun it, or explain it to the judges.

## Where the data came from

Art of Living gave us a Drive folder of mock exports from three of their systems: Eventbrite for public events, Harmony for programs and participants, and Retreat Guru for retreats. Everyone in it is fictional, but the data is messy in realistic ways. The same person often shows up in all three systems, in capitals in one place and with a slightly different email in another.

There were 27 files. We used 15 and left the rest out on purpose:

| Left out | Why |
| --- | --- |
| Orders, ticket prices, fees, transactions | TeamUp doesn't handle payments |
| Health consent, dietary needs, emergency contacts | Health and personal details a volunteer app shouldn't hold |
| Birth dates, gender, home addresses | Not needed for matching |
| Rooms, rentals, accommodations | Retreat housing, outside what TeamUp does |
| Children's retreat registrations | Minors' data |
| `source_records.csv` | A duplicate of the other files |

The folder also had a sheet pointing to Art of Living's live course API. The sheet asks teams not to overload it, so we took only the 16 course names and never call the API.

## How we built it

1. Downloaded the files, cleaned them, and saved the cleaned versions in the repo under `data/`.
2. Planned the tables around the TeamUp spec and wrote them, with all the access rules, into one file: `db/schema.sql`.
3. Wrote a seed script (`scripts/seed.mjs`) that reads the cleaned files, combines duplicate people, fills in sample skills and availability, and uploads everything to Supabase.
4. Ran it all in a private test project first and fixed what broke. Then we ran the same steps on the team's Supabase project and pushed the code to the `feat/database` branch.

## What's in the database

| Table | What it holds | Rows |
| --- | --- | --- |
| `people` | Everyone, after combining duplicates | 10,368 |
| `person_sources` | Which original records belong to each person | 29,120 |
| `profiles` | App accounts and their role (volunteer or organizer) | Filled at sign-up |
| `volunteer_profiles` | Volunteers' skills and whether they're open to last-minute seva | 1,175 |
| `availability` | Weekly free times | 2,345 |
| `events` | Programs and events, with time, place, and what help they need | 903 |
| `invitations` | Who's been invited to what, and their answer | Filled by organizers |
| `courses` | Course names for the sign-up form | 16 |

For search, organizers go through two helpers rather than the tables. `volunteer_directory` lists volunteers with their city, skills, and last course, but no contact details. `match_volunteers` takes an event and returns the best-fit volunteers, each with a short reason like "Skills: Photography" or "Free on Sundays at this time."

The ranking is simple and rule-based. A volunteer has to be free at the event's time, and then skills count for 50%, availability for 35%, and living in the same city for 15%.

## Combining duplicate people

This was the trickiest part. The files hold 29,120 person records, but many of them are the same person. Jovana Novak, for example, appears five times across Eventbrite and Retreat Guru, once as "JOVANA Novak" with a .com email instead of .net.

The seed script treats two records as one person when they share an email (ignoring dots and +tags), the same inbox name plus the same name, the same phone plus the same name, or the same name in the same city. Name order doesn't matter, so "Ho Huong" and "Huong Ho" match.

That brought it down to 10,368 people. Checked against the answer key Art of Living provided, 99.7% of the merges were right and we caught 97.3% of the duplicates. The answer key is only used for that check, not for the matching itself.

## Real data and sample data

Names, contact details, course history, events, and who's a volunteer or teacher all come from the mock files. Volunteers are people Harmony marks as Volunteer or Staff, or who took the Volunteer Training Program: 1,175 in total. Teachers come from Harmony and Retreat Guru: 70 in total.

The files don't say what skills volunteers have, when they're free, or what each event needs. Matching can't be shown without those, so the seed script adds sample values: two to four skills per volunteer from a list of 12 common seva roles, one to three weekly time slots, and staffing needs for each event. All of it is flagged with `is_simulated` so the app can label it. Real volunteers enter their own when they sign up.

## Who can see what

Every table has Row Level Security turned on. These are rules inside the database itself, checked on every request, so they hold even if someone tampers with the app in their browser.

| | Volunteer | Organizer (teacher) |
| --- | --- | --- |
| Own profile, skills, availability | See and edit | See and edit |
| Other volunteers | Can't see | Can search, without emails or phones |
| Events | See all | See all; create and edit their own |
| Invitations | See their own; accept or decline | Send for their events; see responses |
| Contact details | Only their own | Only for people they've invited |

An administrator grants organizer access on a verified account. The Teacher choice at signup records a preference. The database prevents users from changing their own role and prevents duplicate invitations for the same event and volunteer.

## Teacher Portal

Apply the [Teacher Portal migration](../supabase/migrations/20261115005932_teacher_portal.sql) after the onboarding migrations. The portal uses owned events, the organizer directory, and in-app invitations. Matching checks whether a volunteer’s scheduled slots cover the full event across both time zones. Priority events rank volunteers open to Emergency Seva first among available matches. Volunteers accept or decline from **Your Account → Invitations**.

## Keys and the seed script

The seed script is the one thing allowed past these rules, because it uses the secret service-role key. That key lives only in `.env.local` on the laptop that runs the seed. It isn't in GitHub, and it shouldn't go into Vercel.

## Rebuilding it

To set it up in a fresh Supabase project, put the project's URL and keys in `.env.local`, run `db/schema.sql` in the SQL Editor, apply the files in [`supabase/migrations`](../supabase/migrations) in filename order, then run `npm run seed`. It takes a few minutes, and you should end up with 10,368 people, 903 events, and 16 courses. Seed refreshes replace mock records, including any schedules or invitations attached to those records.

## Things that tripped us up

- GitHub no longer accepts account passwords for git, so cloning the repo needed a personal access token.
- Supabase blocks DELETE statements without a WHERE clause, which broke the seed's reset step until we added one.
- The team project has "Automatically expose new tables" turned on. We added a lockdown to the schema so our access rules hold either way.
