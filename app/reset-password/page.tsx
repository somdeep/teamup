import type { Metadata } from "next";
import Link from "next/link";
import { isLive } from "../../lib/auth-config";
import { validEmailToken } from "../../lib/auth-input";
import { AuthForm } from "../auth/auth-form";
import { AuthShell } from "../auth/auth-shell";
import { resetPassword } from "../auth/actions";
import styles from "../sign-up/sign-up.module.css";

export const metadata: Metadata = {
  title: "Reset Password | TeamUp",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  const canReset = isLive && validEmailToken(token_hash);
  return (
    <AuthShell title="Reset Your Password" description={canReset ? "Choose a new password with at least 12 characters." : undefined}>
      {canReset
        ? <AuthForm action={resetPassword.bind(null, token_hash)} label="Update Password" mode="reset" />
        : <p className={styles.notice}>This password reset link is unavailable.</p>}
      <p className={styles.authFooter}><Link href="/forgot-password">Request a new reset link</Link></p>
    </AuthShell>
  );
}
