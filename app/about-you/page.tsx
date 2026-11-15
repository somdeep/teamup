import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sevaProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import { AuthShell } from "../auth/auth-shell";
import { OnboardingProgress } from "../auth/onboarding-progress";
import { AboutYouForm } from "./about-you-form";
import styles from "./about-you.module.css";

export const metadata: Metadata = { title: "Tell Us About Yourself | TeamUp", robots: { index: false } };

export default async function AboutYouPage() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const { data: profile, error } = await sevaProfile(client);
  if (!profile && !error) redirect("/account");

  return (
    <AuthShell
      title="Tell Us About Yourself"
      description="Help us match you with the right opportunities."
      beforeTitle={profile && !profile.complete && <OnboardingProgress step={3} />}
    >
      {profile ? <AboutYouForm profile={profile} /> : (
        <div className={styles.unavailable}>
          <p role="alert">We couldn’t load your seva preferences. Refresh this page to try again.</p>
          <Link className="landing-button secondary" href="/account">Back to Account</Link>
        </div>
      )}
    </AuthShell>
  );
}
