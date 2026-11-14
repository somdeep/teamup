# TeamUp landing page

Use the supplied TeamUp mockup as the visual reference for the public landing page. Build the layout as a single, centered column on mobile, with the same reading order on larger screens.

1. Feature the TeamUp wordmark and the two figures reaching toward a heart. Keep the cream background and the teal and saffron palette.
2. Set the supplied seva quote as live text between the gold lotus dividers. The mockup shows this wording and attribution:

   > “Service purifies the mind, expands the heart, and brings a deep sense of fulfillment.”
   >
   > — Gurudev Sri Sri Ravi Shankar

3. Stack two full-width actions. Use the orange gradient and right arrow for **Get Started**, and the teal outline for **Log In**. Keep the overlapping teal and saffron waves at the bottom.

## Proposed button flows

| Action | Destination |
| --- | --- |
| **Get Started** | Open Google sign-in. After sign-in, guide a new volunteer through city, skills, interests, and availability. |
| **Log In** | Open the same Google sign-in. After sign-in, take a returning user to their TeamUp workspace using their assigned role. |

Both actions use Google through Supabase Auth. TeamUp assigns the organizer role. Keep the buttons and quote separate from the artwork so they remain readable and accessible on mobile.
