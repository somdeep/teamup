---
name: teamup-deploy
description: Verify and deploy the TeamUp Next.js application through Supabase, GitHub, and Vercel. Use for TeamUp setup, migration, release, deployment, redeployment, or deployment troubleshooting requests.
---

# TeamUp Deploy

Deploy TeamUp without leaking credentials, mixing Supabase projects, or overwriting unrelated work. Treat the repository [README](../../../README.md) as the current setup contract and inspect it before acting.

## Boundaries

- A request to inspect, explain, or troubleshoot is read-only. Do not commit, push, apply migrations, seed data, change Vercel settings, or deploy unless the user requests that mutation.
- A request to deploy does not automatically authorize database migrations, seed operations, history rewrites, or destructive cleanup. Call out each additional mutation and get approval when it is not explicit.
- Never print secret values. Report only whether required variables are present and where they are configured.
- Never commit `.env.local`, database passwords, service-role keys, OAuth client secrets, SMTP credentials, access tokens, raw exports, or account-specific seed data.
- Preserve unrelated tracked and untracked changes. Do not stage the entire repository blindly.

## Preflight

1. Read `AGENTS.md` files that apply to the repository and inspect `git status`, the current branch, remotes, and recent commits.
2. Confirm `.env.local` is ignored and not tracked. Scan the staged diff and tracked files for high-confidence credentials before any push.
3. Confirm the required environment-variable names are present without showing values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the supported anon-key fallback)
   - `TEAMUP_SITE_URL`
4. Run the proportional release checks. For a production deployment, use:

   ```bash
   npm ci
   npm test
   npm run lint
   npm run typecheck
   npm run build
   ```

Stop on a failure and report the concrete error. Do not deploy a knowingly broken build.

## Supabase

1. Use the Supabase CLI and confirm the linked project before applying anything:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase migration list --linked
   ```

2. Review pending migration files and distinguish schema/RLS changes from optional sample data.
3. Apply approved migrations with `npx supabase db push`. Never reset the remote database as a routine deployment step.
4. Do not seed a shared or production project unless the user explicitly names that project and asks for seeding.
5. Verify Auth Site URL and callback routes match the exact local or production origin. Keep Google and SMTP secrets in their provider dashboards.

## GitHub and Vercel

Prefer the existing GitHub-to-Vercel integration when it is healthy:

1. Stage only the intended files, show the staged summary, and commit or push only when explicitly requested.
2. A push to the configured production branch should trigger Vercel automatically; do not add a deploy hook unless a separate external trigger is actually required.
3. In Vercel, configure only variable names and values through Project Settings or `vercel env add`. Never place secret values in commands, logs, documentation, or tracked files.
4. For an explicitly requested CLI production deploy, use the already-linked project or run `npx vercel link`, then `npx vercel --prod`.
5. Verify the resulting deployment is **Ready**, record the deployment URL and source commit, and test the landing page plus one authenticated Teacher and Volunteer journey. Check a narrow mobile viewport for demo releases.

## Handoff

Report:

- checks run and their outcomes;
- commit and push status;
- Supabase project linkage and migration status without identifiers or secrets;
- Vercel deployment state and public URL;
- auth callback or environment work still required; and
- any changes deliberately left local or stashed.

If a credential or private export was ever committed, rotate the credential first. Removing it from the latest tree is not enough; explain that Git history must be sanitized and force-pushed only with explicit approval and collaborator coordination.
