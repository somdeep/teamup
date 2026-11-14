import type { Metadata } from "next";
import Link from "next/link";
import { isLive } from "../../../lib/auth-config";
import { validEmailToken } from "../../../lib/auth-input";
import { AuthForm } from "../auth-form";
import { AuthShell } from "../auth-shell";
import { confirmEmail } from "../actions";
import styles from "../../sign-up/sign-up.module.css";

export const metadata: Metadata = {
  title: "Confirm Email | TeamUp",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  return (
    <AuthShell title="Confirm Your Email">
      {isLive && validEmailToken(token_hash)
        ? <AuthForm action={confirmEmail.bind(null, token_hash)} label="Confirm Email" mode="confirm" />
        : <p className={styles.notice}>This confirmation link is unavailable.</p>}
      <p className={styles.authFooter}><Link href="/login">Back to log in</Link></p>
    </AuthShell>
  );
}
