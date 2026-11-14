import type { Metadata } from "next";
import Link from "next/link";
import { isLive } from "../../lib/auth-config";
import { AuthForm } from "../auth/auth-form";
import { AuthShell } from "../auth/auth-shell";
import { requestPasswordReset } from "../auth/actions";
import styles from "../sign-up/sign-up.module.css";

export const metadata: Metadata = { title: "Forgot Password | TeamUp" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot Password" description="Enter the email address you use with TeamUp.">
      {isLive
        ? <AuthForm action={requestPasswordReset} label="Send Reset Link" mode="forgot" />
        : <p className={styles.notice}>Password recovery is unavailable in this preview.</p>}
      <p className={styles.authFooter}><Link href="/login">Back to log in</Link></p>
    </AuthShell>
  );
}
