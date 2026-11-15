import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { isLive, supabase } from "../../lib/supabase";
import { AuthShell } from "../auth/auth-shell";
import { OnboardingProgress } from "../auth/onboarding-progress";
import { MyAvailabilityForm } from "./availability-form";
import styles from "./availability.module.css";

export const metadata: Metadata = { title: "My Availability | TeamUp", robots: { index: false } };

export default async function MyAvailabilityPage() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const { data: profile, error } = await sevaAvailabilityProfile(client);
  if (!profile && !error) redirect("/account");
  if (profile && !profile.complete) redirect("/about-you");
  if (profile && !profile.skills_reviewed) redirect("/my-skills");

  return (
    <AuthShell title="My Availability" description="Let us know when you’re generally free to volunteer."
      backHref="/my-skills" backLabel="Back to My Skills"
      beforeTitle={profile && !profile.availability_reviewed && <OnboardingProgress step={5} />}>
      {profile ? <MyAvailabilityForm profile={profile} /> : (
        <div className={styles.unavailable}>
          <p role="alert">We couldn’t load your availability. Refresh to try again.</p>
          <Link className="landing-button secondary" href="/account">Back to Account</Link>
        </div>
      )}
    </AuthShell>
  );
}
