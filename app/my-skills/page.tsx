import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sevaSkillsProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import { OnboardingProgress } from "../auth/onboarding-progress";
import { MySkillsForm } from "./skills-form";
import styles from "./skills.module.css";

export const metadata: Metadata = { title: "My Skills | TeamUp", robots: { index: false } };

export default async function MySkillsPage() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const { data: profile, error } = await sevaSkillsProfile(client);
  if (!profile && !error) redirect("/account");
  if (profile && !profile.complete) redirect("/about-you");

  return (
    <AuthShell
      title={<span className={styles.title}>My Skills</span>}
      description="Select what you can contribute to events."
      backHref="/about-you"
      backLabel="Back to seva preferences"
      beforeTitle={profile && !profile.skills_reviewed && <OnboardingProgress step={4} />}
      headerActions={<PortalHeaderActions />}
    >
      {profile ? <MySkillsForm profile={profile} /> : (
        <div className={styles.unavailable}>
          <p role="alert">We couldn’t load your skills. Refresh to try again.</p>
          <Link className="landing-button secondary" href="/account">Back to Account</Link>
        </div>
      )}
    </AuthShell>
  );
}
