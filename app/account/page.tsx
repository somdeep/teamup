import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountProfile } from "../../lib/account-profile";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import { signOut } from "../auth/actions";
import { AuthShell } from "../auth/auth-shell";
import styles from "../sign-up/sign-up.module.css";

export const metadata: Metadata = { title: "Your Account | TeamUp", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string; view?: string }> }) {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  if (!data.user.email_confirmed_at) redirect("/login?notice=check-email");
  const { data: profile, error: profileError } = await accountProfile(client);
  if (!profile && !profileError) redirect("/complete-profile");
  if (profile) {
    const { data: details } = await sevaAvailabilityProfile(client);
    if (details && !details.complete) redirect("/about-you");
    if (details && !details.skills_reviewed) redirect("/my-skills");
    if (details && !details.availability_reviewed) redirect("/my-availability");
  }

  const { notice, view } = await searchParams;
  const { data: organizer } = profile ? await client.rpc("is_organizer") : { data: false };
  if (organizer === true && view !== "settings" && !notice) redirect("/teacher");
  return (
    <AuthShell title="Your Account">
      <section className={styles.confirmation} aria-label="Account details">
        {profile && <h2>{profile.display_name}</h2>}
        <p>{data.user.email}</p>
        {profile ? <>
          <p>Signup preference · {profile.signup_intent}</p>
          {profile.contact_phone && <p>Phone · {profile.contact_phone}</p>}
          {profile.last_course && <p>Last course · {profile.last_course}</p>}
          {profile.courses.length > 0 && <p>Courses · {profile.courses.join(", ")}</p>}
          {profile.skills.length > 0 && <p>Skills · {profile.skills.join(", ")}</p>}
        </> : <p role="alert">We couldn’t load your profile. Refresh this page to try again.</p>}
        {notice === "signout-failed" && <p role="alert">Couldn’t log out. Please try again.</p>}
        {notice === "seva-saved" && <p role="status">Your seva preferences were saved.</p>}
        {notice === "skills-saved" && <p role="status">Your skills and learning interests were saved.</p>}
        {notice === "availability-saved" && <p role="status">Your profile was saved.</p>}
        {notice === "teacher-access" && <p role="status">The Teacher Portal is available to approved organizers.</p>}
        {organizer === true && <Link className="landing-button primary" href="/teacher">Teacher Portal</Link>}
        {profile && <Link className="landing-button secondary" href="/invitations">Invitations</Link>}
        {profile && <Link className="landing-button secondary" href="/about-you">Edit Seva Preferences</Link>}
        {profile && <Link className="landing-button secondary" href="/my-skills">Edit My Skills</Link>}
        {profile && <Link className="landing-button secondary" href="/my-availability">Edit Availability</Link>}
        <form action={signOut}>
          <button className="landing-button secondary">Log Out</button>
        </form>
      </section>
    </AuthShell>
  );
}
