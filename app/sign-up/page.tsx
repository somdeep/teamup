import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isLive, supabase } from "../../lib/supabase";
import { isGoogleAvailable } from "../../lib/google-auth";
import { AuthShell } from "../auth/auth-shell";
import { GoogleSignIn } from "../auth/google-sign-in";
import { AccountSignUpForm, SignUpForm } from "./sign-up-form";
import styles from "./sign-up.module.css";

export const metadata: Metadata = {
  title: "Create Your Profile | TeamUp",
  description: "Create a TeamUp account for seva.",
};

export default async function SignUpPage() {
  if (isLive) {
    const client = await supabase();
    const { data } = await client.auth.getUser();
    if (data.user?.email_confirmed_at) redirect("/account");
  }
  const googleAvailable = await isGoogleAvailable();
  return (
    <AuthShell
      title="Create Your Profile"
      description="Join as a Teacher or Volunteer."
    >
      {isLive ? <AccountSignUpForm /> : <SignUpForm />}
      {googleAvailable && <GoogleSignIn available />}
      <p className={styles.authFooter}>Already have an account? <Link href="/login">Log in</Link></p>
    </AuthShell>
  );
}
