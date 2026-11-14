# TeamUp

TeamUp helps Art of Living coordinators find and invite volunteers for seva.

[Live landing page](https://teamup-gray.vercel.app)

The current release is the public landing page. Sign-in and onboarding are coming soon.

## Run locally

With Node.js 22.14 or newer, run `npm ci` and `npm run dev`, then open [localhost:3000](http://localhost:3000).

The landing page runs without credentials. For local development that needs credentials, use the Git-ignored `.env.local` file and use [`.env.example`](.env.example) as the template. Store production credentials in Vercel environment variables.

## Deploy to Vercel

1. Run `npm run build` before merging.
2. Merge the pull request into `main` to trigger the Vercel deployment.
3. Once Vercel shows **Ready**, open the live landing page linked above.
