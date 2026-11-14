import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLive, supabase } from "../../lib/supabase";
import { hasCompletedSignupProfile } from "../../lib/signup-profile";
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
  if (!hasCompletedSignupProfile(data.user.user_metadata)) redirect("/complete-profile");

  const { notice } = await searchParams;
  const { display_name, signup_intent, contact_phone, last_course, signup_expertise } = data.user.user_metadata;
  return (
    <AuthShell title="Your Account">
      <section className={styles.confirmation} aria-label="Account details">
        <h2>{display_name}</h2>
        <p>{data.user.email}</p>
        <p>Joined as · {signup_intent}</p>
        {typeof contact_phone === "string" && contact_phone && <p>Phone · {contact_phone.slice(0, 32)}</p>}
        {typeof last_course === "string" && last_course && <p>Last course · {last_course.slice(0, 120)}</p>}
        {Array.isArray(signup_expertise) && signup_expertise.length > 0 && (
          <p>Courses and expertise · {signup_expertise.filter(value => typeof value === "string").slice(0, 10).join(", ")}</p>
        )}
        {notice === "signout-failed" && <p role="alert">Couldn’t log out. Please try again.</p>}
        <form action={signOut}>
          <button className="landing-button secondary">Log Out</button>
        </form>
      </section>
    </AuthShell>
  );
}
