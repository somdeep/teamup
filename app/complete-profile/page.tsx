import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { needsProfileCompletion, storedAccountProfile } from "../../lib/account-profile";
import { isLive, supabase } from "../../lib/supabase";
import { signOut } from "../auth/actions";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import { AccountSignUpForm } from "../sign-up/sign-up-form";
import styles from "../sign-up/sign-up.module.css";

export const metadata: Metadata = { title: "Complete Your Profile | TeamUp", robots: { index: false } };

export default async function CompleteProfilePage() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");
  const { data: profile, error: profileError } = await storedAccountProfile(client, user.id);
  if (profileError) throw new Error("Could not check your TeamUp profile.");
  if (!needsProfileCompletion(profile)) redirect("/account");

  const { display_name, full_name, name } = user.user_metadata;
  const defaultName = [display_name, full_name, name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return (
    <AuthShell
      title="Complete Your Profile"
      description="Choose how you’d like to join TeamUp."
      headerActions={<PortalHeaderActions />}
    >
      <AccountSignUpForm verifiedProfile={{ name: defaultName?.trim().slice(0, 100) ?? "", email: user.email ?? "" }} />
      <form action={signOut} className={styles.authFooter}>
        <button className="landing-button secondary">Log Out</button>
      </form>
    </AuthShell>
  );
}
