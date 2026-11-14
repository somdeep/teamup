"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { minimumPasswordLength } from "../../lib/auth-input";
import styles from "../sign-up/sign-up.module.css";
import type { AuthResult } from "./actions";

export function EmailField({ named = true, requiredMarker = false } = {}) {
  return (
    <label className={styles.field}>
      <Mail size={24} aria-hidden="true" />
      <span>
        <span className={styles.fieldName}>Email{requiredMarker && <span aria-hidden="true" className={styles.required}>*</span>}</span>
        <input name={named ? "email" : undefined} type="email" autoComplete={named ? "email" : "off"} maxLength={254} placeholder="name@example.com" required />
      </span>
    </label>
  );
}

export function PasswordField({ label = "Password", name = "password", isNew = false }) {
  return (
    <label className={styles.field}>
      <LockKeyhole size={24} aria-hidden="true" />
      <span>
        <span className={styles.fieldName}>{label}</span>
        <input
          name={name}
          type="password"
          autoComplete={isNew ? "new-password" : "current-password"}
          minLength={isNew ? minimumPasswordLength : undefined}
          maxLength={isNew ? 72 : 1024}
          required
        />
      </span>
    </label>
  );
}

export function AuthForm({
  action, label, mode,
}: {
  action: (state: AuthResult, form: FormData) => Promise<AuthResult>;
  label: string;
  mode: "login" | "forgot" | "reset" | "confirm";
}) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className={styles.form}>
      {(mode === "login" || mode === "forgot") && <EmailField />}
      {mode === "login" && <>
        <PasswordField />
        <Link href="/forgot-password" className={styles.trailingLink}>Forgot password?</Link>
      </>}
      {mode === "reset" && <>
        <PasswordField label="New password" isNew />
        <PasswordField label="Confirm new password" name="confirmPassword" isNew />
      </>}
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className="landing-button primary" disabled={pending}>
        {pending ? "Please wait…" : label} <ArrowRight size={22} aria-hidden="true" />
      </button>
    </form>
  );
}
