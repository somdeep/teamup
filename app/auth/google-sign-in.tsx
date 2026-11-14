"use client";

import { useActionState } from "react";
import { signInWithGoogle } from "./actions";
import styles from "../sign-up/sign-up.module.css";

export function GoogleSignIn({ available }: { available: boolean }) {
  const [state, submit, pending] = useActionState(signInWithGoogle, {});

  return (
    <form action={submit} className={styles.googleForm}>
      <p className={styles.divider}>or</p>
      <button className="landing-button secondary" disabled={!available || pending}>
        {pending ? "Connecting…" : "Continue with Google"}
      </button>
      {!available && <p className={styles.fieldHint}>Google sign-in is unavailable right now.</p>}
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    </form>
  );
}
