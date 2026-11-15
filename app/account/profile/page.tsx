import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { editableAccountProfile } from "../../../lib/account-profile";
import { isLive, supabase } from "../../../lib/supabase";
import { AuthShell } from "../../auth/auth-shell";
import { PortalHeaderActions } from "../../auth/portal-header-actions";
import { AccountProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Edit Profile | TeamUp", robots: { index: false } };

export default async function AccountProfilePage() {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=check-email");

  const { data: profile, error } = await editableAccountProfile(client);
  if (!profile && !error) redirect("/complete-profile");
  if (!profile) redirect("/account?view=settings");

  return <AuthShell title="Edit Profile" description="Keep your contact details and location up to date."
    backHref="/account?view=settings" backLabel="Back to Your Account" headerActions={<PortalHeaderActions />}>
    <AccountProfileForm profile={profile} />
  </AuthShell>;
}
