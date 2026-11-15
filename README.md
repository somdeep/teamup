# TeamUp

<img src="docs/assets/gurudev.jpeg" alt="Illustration of Gurudev Sri Sri Ravi Shankar smiling" width="112" height="101">

TeamUp helps Art of Living coordinators find and invite volunteers for seva.

[![Production site availability](https://img.shields.io/website?url=https%3A%2F%2Fteamup-gray.vercel.app%2F&label=production%20site&up_message=online&down_message=offline&logo=vercel)](https://teamup-gray.vercel.app)
[![Hosted on Vercel](https://img.shields.io/badge/hosting-Vercel-black)](https://teamup-gray.vercel.app)

[Live landing page](https://teamup-gray.vercel.app)

TeamUp supports email and Google sign-in, volunteer onboarding, and a Teacher Portal for creating events and coordinating invitations.

## Run locally

With Node.js 22.14 or newer, run `npm ci` and `npm run dev`, then open [localhost:3000](http://localhost:3000).

The landing page runs without credentials. For local development, use [`.env.example`](.env.example) as the template for the Git-ignored `.env.local` file. See [Supabase Auth setup](docs/email-auth.md) for email and Google sign-in.

## Deploy to Vercel

1. Run `npm run build` before merging.
2. Merge the pull request into `main` to trigger the Vercel deployment.
3. Once Vercel shows **Ready**, open the live landing page linked above.
