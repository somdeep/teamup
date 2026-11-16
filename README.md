# TeamUp

<img src="docs/assets/gurudev.jpeg" alt="Illustration of Gurudev Sri Sri Ravi Shankar smiling" width="112" height="101">

TeamUp helps Art of Living teachers coordinate events and invite volunteers for seva. It includes email and Google authentication, role-aware onboarding, teacher and volunteer portals, volunteer matching, invitations, event circles, message boards, and event resources.

No public TeamUp deployment URL is published from this repository. Run the app locally or deploy it into an environment you control using the instructions below.

## Prerequisites

- Node.js 22.14 or newer
- npm
- A Supabase project for the full authenticated app
- A Vercel account for hosted deployments
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and [Vercel CLI](https://vercel.com/docs/cli)

The public landing page can run without Supabase credentials. Authentication, profiles, events, matching, invitations, uploads, and message boards require Supabase.

## Run locally

1. Clone the repository and install the locked dependencies:

   ```bash
   git clone https://github.com/somdeep/teamup.git
   cd teamup
   npm ci
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

   On PowerShell, use `Copy-Item .env.example .env.local`.

3. Add your Supabase project URL and publishable key to `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   TEAMUP_SITE_URL=http://localhost:3000
   ```

4. Apply the database migrations to your own Supabase project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   `db push` changes the linked database. Confirm the project shown by the CLI before approving it.

5. Start TeamUp and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

The repository does not publish account-specific seed records or raw source exports. Create test accounts through the app, or use your own private seed process outside Git.

## Environment variables

| Variable | Required | Where to set it | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Full app | `.env.local` and Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Full app | `.env.local` and Vercel | Browser-safe Supabase publishable key; RLS still protects data |
| `TEAMUP_SITE_URL` | Recommended | `.env.local` and Vercel Production | Exact origin used for auth links and callbacks |

The older `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable is accepted as a fallback, but new deployments should use the publishable key.

Never commit `.env.local`, database passwords, service-role keys, Google client secrets, SMTP credentials, or access tokens. Do not prefix a secret with `NEXT_PUBLIC_`; those variables are bundled for the browser. `.env*` is ignored except for the empty `.env.example` template.

## Configure Supabase

1. Create a Supabase project.
2. Copy its project URL and publishable key from the project’s API settings into `.env.local`.
3. Link the correct project and run `npx supabase db push` to create TeamUp’s tables, functions, policies, and storage configuration.
4. In **Authentication → URL Configuration**, set:
   - Site URL: `http://localhost:3000` while testing locally
   - Redirect URL: `http://localhost:3000/auth/callback`
5. Enable the Email provider. For community use, configure custom SMTP and turn email confirmation on.
6. Optional Google login: create a Google Web OAuth client, register the callback URL displayed in Supabase’s Google provider settings, then enter the Google client ID and secret in Supabase—not in this repository.

For the exact email templates, recovery routes, Google setup, and production callback URLs, read [Supabase email and Google authentication](docs/email-auth.md).

## Deploy to Vercel

### Recommended: GitHub integration

1. Push the repository to GitHub without any `.env` file or private data.
2. In Vercel, choose **Add New → Project**, import the GitHub repository, and keep the detected Next.js settings.
3. Add these environment variables in **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `TEAMUP_SITE_URL`, set to the final HTTPS production origin
4. Deploy. Vercel will run the standard Next.js build.
5. Add the production URLs to Supabase Auth:
   - Site URL: `https://YOUR_DOMAIN`
   - Redirect URL: `https://YOUR_DOMAIN/auth/callback`
   - Reset route: `https://YOUR_DOMAIN/reset-password`
6. Test email login, Google login if enabled, profile completion, one teacher flow, and one volunteer flow.

After the GitHub integration is connected, every push to the production branch triggers a deployment. A separate deploy hook is not needed for normal Git-based deployments.

### Optional: Vercel CLI

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npx vercel env add TEAMUP_SITE_URL production
npx vercel --prod
```

Use the Vercel dashboard to verify that secrets were added to the intended environments. Do not pass secret values on a shared command line or save them in the repository.

## Pre-deploy checks

Run the same checks locally before a demo or production deployment:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Then verify:

- Supabase migrations are applied to the intended project.
- Row Level Security remains enabled and tested for both Teacher and Volunteer accounts.
- Auth redirect URLs exactly match the local or production origin.
- Vercel has only public Supabase client values; privileged keys remain server-side and outside this repository.
- The deployment is **Ready**, the landing page loads, and the main authenticated journeys work on mobile.

## Project documentation

- [Database and roles](docs/DATABASE.md)
- [Email and Google authentication](docs/email-auth.md)
- [Future scope](docs/future-scope.md)
- [Fetch assistant](docs/fetch-assistant.md)
- [Reusable TeamUp deployment skill](.codex/skills/teamup-deploy/SKILL.md)

## Security note

This repository intentionally excludes local environment files and raw source exports. If a credential is ever committed, deleting the file in a later commit is not enough: rotate the credential, remove it from Git history, and force-push the sanitized history only after coordinating with collaborators.
