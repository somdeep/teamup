import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isLive, supabase } from "../../lib/supabase";
import { isGoogleAvailable } from "../../lib/google-auth";
import { AuthForm } from "../auth/auth-form";
import { AuthShell } from "../auth/auth-shell";
import { GoogleSignIn } from "../auth/google-sign-in";
import { signIn } from "../auth/actions";
import styles from "../sign-up/sign-up.module.css";

export const metadata: Metadata = { title: "Log In | TeamUp" };

const notices = {
  "check-email": "If this address can be used for signup, you’ll receive a confirmation email. Already registered? Log in or reset your password.",
  "reset-email": "If there’s an eligible account for this address, you’ll receive a password reset email.",
  "password-updated": "Your password was updated. Log in with your new password.",
  "google-failed": "Google sign-in couldn’t be completed. Try again or log in with email.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  if (isLive && !notice) {
    const client = await supabase();
    const { data } = await client.auth.getUser();
    if (data.user?.email_confirmed_at) redirect("/account");
  }
  const message = notice && Object.hasOwn(notices, notice) ? notices[notice as keyof typeof notices] : null;
  const googleAvailable = await isGoogleAvailable();
  return (
    <AuthShell title="Welcome Back!">
      {message && <p className={styles.notice} role="status">{message}</p>}
      {isLive
        ? <AuthForm action={signIn} label="Log In" mode="login" />
        : <p className={styles.notice}>Email login is unavailable in this preview.</p>}
      <GoogleSignIn available={googleAvailable} />
      <p className={styles.authFooter}>New to TeamUp? <Link href="/sign-up">Create Account</Link></p>
    </AuthShell>
  );
}
