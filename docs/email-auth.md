# Supabase email authentication

TeamUp uses Supabase Auth for email and password accounts. Once Supabase is configured, **Get Started** opens account signup and **Log In** opens email login. A verified account opens `/account`. The signup choice of Teacher or Volunteer is stored as a preference only. Profile setup and teacher approval are separate steps.

This flow uses the imported TeamUp schema with `people`, `profiles`, `volunteer_profiles`, and `courses`. Apply the [signup profiles migration](../supabase/migrations/20261114231330_signup_profiles.sql) to that schema before deploying this version. Existing verified accounts with signup details are migrated on their next sign-in.

## Configure the app

1. Copy [`.env.example`](../.env.example) to the Git-ignored `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the project. The Vercel integration’s `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works as a fallback.
2. Set `TEAMUP_SITE_URL` to the exact app origin for the environment, such as `http://localhost:3000` or `https://teamup-gray.vercel.app`. Use HTTPS in production. Keep Auth admin and SMTP secrets out of public variables and the repo.
3. In Supabase Auth, enable the Email provider and keep **Confirm email** on. Configure a server-side minimum password length of 12 to match the app. In **URL Configuration**, set the Site URL and allow the exact `/auth/confirm` and `/reset-password` URLs for each environment you use.
4. In the Supabase email templates, replace the confirmation and recovery links with the corresponding HTML below. Disable link tracking for auth emails. Configure custom SMTP before sending to community members. Supabase’s default mail service is limited to project-team addresses.

**Confirm signup**

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Confirm your email</a>
```

**Reset password**

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Reset your password</a>
```

The app supplies a fixed redirect path for each email. A GET renders the form and an explicit submission verifies the one-time token. Test signup and reset with a mail test inbox, including opening the link on a different browser, then confirm sign-in and sign-out work. Keep Supabase’s Auth rate limits enabled.

[Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)

## Enable Google login

1. In Google Auth Platform, configure Branding and set the audience to **External** if volunteers use personal Google accounts. Use the basic `openid`, `email`, and `profile` scopes.
2. Create a **Web application** OAuth client. Use the callback shown in **Supabase → Authentication → Sign In / Providers → Google** as the authorized redirect URI in Google. For the hosted project it has the form `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase’s Google provider panel, enter the Google client ID and secret, enable the provider, and save. Keep the secret in Supabase.
4. Under **Supabase → Authentication → URL Configuration**, allow TeamUp’s exact app callbacks `http://localhost:3000/auth/callback` and `https://teamup-gray.vercel.app/auth/callback`. The hostname used to open **Log In** must match the origin used for the callback so the browser can send the PKCE cookie.
5. Open TeamUp’s login or signup page and choose **Continue with Google**. A signed-in account without a TeamUp profile opens `/complete-profile`. Save the name and signup preference to continue to `/account`. Returning users with saved profiles go directly to `/account`.

Supabase Auth manages verification. `public.profiles.id` references the Auth user, and `profiles.person_id` links to the canonical `public.people` record. A verified email with one matching person links to that record. A verified email without a match creates an app person. Profile details and course choices are attached to the account, contact phone and last course go on the linked person, and volunteer skill selections use the same tags as the imported directory. Email signup uses Auth metadata to carry the form through verification.

Signed-in users can read their account profile through RLS. Account linking and signup writes go through an authenticated database function that uses the caller’s verified email. Selecting Teacher records a preference. An administrator assigns organizer access separately.

[Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
