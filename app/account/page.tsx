import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accountProfile } from "../../lib/account-profile";
import { isLive, supabase } from "../../lib/supabase";
import { signOut } from "../auth/actions";
import { AuthShell } from "../auth/auth-shell";
import styles from "../sign-up/sign-up.module.css";

export const metadata: Metadata = { title: "Your Account | TeamUp", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  if (!data.user.email_confirmed_at) redirect("/login?notice=check-email");
  const { data: profile, error: profileError } = await accountProfile(client);
  if (!profile && !profileError) redirect("/complete-profile");

  const { notice } = await searchParams;
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
        <form action={signOut}>
          <button className="landing-button secondary">Log Out</button>
        </form>
      </section>
    </AuthShell>
  );
}
