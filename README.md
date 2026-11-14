# TeamUp

TeamUp helps Art of Living coordinators find and invite volunteers for seva.

[Live landing page](https://teamup-gray.vercel.app)

The current release is the public landing page. Sign-in and onboarding are coming soon.

## Run locally

With Node.js 22.14 or newer, run `npm ci` and `npm run dev`, then open [localhost:3000](http://localhost:3000).

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before merging changes. The landing page needs no Supabase environment variables.

## Deploy to Vercel

The [TeamUp Vercel project](https://vercel.com/team-up15/teamup) is connected to [`somdeep/teamup`](https://github.com/somdeep/teamup). Vercel builds from the repository root with the Next.js preset and runs `npm run build`.

1. Push a feature branch and open a pull request. Review the Vercel preview before merging.
2. Merge into `main` to trigger a production deployment.
3. Check [Vercel Deployments](https://vercel.com/team-up15/teamup/deployments) for **Ready**, then open the [live landing page](https://teamup-gray.vercel.app).

[Landing-page design](docs/landing-page.md) · [MVP spec](TEAMUP_SPEC.md)
