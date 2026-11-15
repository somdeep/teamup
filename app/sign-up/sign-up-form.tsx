"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { ArrowRight, Check, ChevronDown, Flower2, GraduationCap, HeartHandshake, Phone, UserRound, UsersRound } from "lucide-react";
import { expertiseGroups, isSignupIntent, type SignupRole } from "../../lib/signup-profile";
import { completeProfile, signUp } from "../auth/actions";
import { EmailField, PasswordField } from "../auth/auth-form";
import styles from "./sign-up.module.css";

function RolePicker({ teacherRef }: { teacherRef?: Ref<HTMLInputElement> }) {
  return (
    <fieldset className={styles.roles}>
      <legend className="sr-only">Choose how you’d like to join</legend>
      <label className={styles.teacher}>
        <input className="sr-only" name="role" type="radio" value="Teacher" ref={teacherRef} required />
        <span><UserRound size={23} aria-hidden="true" />Teacher</span>
      </label>
      <label className={styles.volunteer}>
        <input className="sr-only" name="role" type="radio" value="Volunteer" />
        <span><HeartHandshake size={25} aria-hidden="true" />Volunteer</span>
      </label>
      <label className={styles.member}>
        <input className="sr-only" name="role" type="radio" value="Member" defaultChecked />
        <span><UsersRound size={23} aria-hidden="true" />Member</span>
      </label>
    </fieldset>
  );
}

export function AccountSignUpForm({ verifiedProfile }: { verifiedProfile?: { name: string; email: string } }) {
  const [state, submit, pending] = useActionState(verifiedProfile ? completeProfile : signUp, {});
  return (
    <form className={styles.form} action={submit} aria-describedby="account-signup-note">
      <RolePicker />
      <ProfileFields initialName={verifiedProfile?.name} verifiedEmail={verifiedProfile?.email} />
      {!verifiedProfile && <>
        <PasswordField isNew />
        <p className={styles.fieldHint}>Use at least 12 characters.</p>
      </>}
      <p id="account-signup-note" className={styles.fieldHint}>
        {!verifiedProfile && "You’ll get a confirmation email. "}Choose Teacher to request access. Verified roster teachers are approved automatically.
      </p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className="landing-button primary" disabled={pending}>
        {pending ? "Saving profile…" : verifiedProfile ? "Save Profile" : "Create Profile"} <ArrowRight size={22} aria-hidden="true" />
      </button>
    </form>
  );
}

export function SignUpForm() {
  const [completed, setCompleted] = useState<SignupRole | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    if (!hasReviewed) return;
    if (completed) headingRef.current?.focus();
    else roleRef.current?.focus();
  }, [completed, hasReviewed]);

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.querySelector<HTMLInputElement>("#fullName");
    if (!name) return;
    if (!name.value.trim()) {
      name.setCustomValidity("Enter your full name.");
      name.reportValidity();
      return;
    }

    const role = new FormData(form).get("role");
    if (isSignupIntent(role)) {
      setCompleted(role);
      setHasReviewed(true);
    }
  }

  if (completed) {
    return (
      <section className={styles.confirmation} aria-labelledby="preview-heading">
        <Check size={29} aria-hidden="true" />
        <h2 id="preview-heading" ref={headingRef} tabIndex={-1}>Profile preview complete</h2>
        <p>You chose {completed}.</p>
        <p>Your details weren’t saved.</p>
        <button type="button" className="landing-button secondary" onClick={() => setCompleted(null)}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submitProfile} autoComplete="off" aria-describedby="signup-preview">
      <RolePicker teacherRef={roleRef} />

      <ProfileFields preview />

      <div className={styles.actions}>
        <button className="landing-button primary" type="submit">
          Create Profile <ArrowRight aria-hidden="true" size={25} strokeWidth={2.5} />
        </button>
        <p id="signup-preview">Signup preview. Use sample details to try the form.</p>
      </div>
    </form>
  );
}

function ProfileFields({ preview = false, initialName, verifiedEmail }: {
  preview?: boolean;
  initialName?: string;
  verifiedEmail?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <label className={styles.field}>
        <UserRound size={25} aria-hidden="true" />
        <span>
          <span className={styles.fieldName}>Full Name<span aria-hidden="true" className={styles.required}>*</span></span>
          <input id="fullName" name={preview ? undefined : "fullName"} type="text" autoComplete={preview ? "off" : "name"} required maxLength={100} placeholder="First and last name" defaultValue={initialName} onInput={event => event.currentTarget.setCustomValidity("")} />
        </span>
      </label>
      <EmailField named={!preview} requiredMarker={verifiedEmail === undefined} verifiedEmail={verifiedEmail} />
      <label className={styles.field}>
        <Phone size={25} aria-hidden="true" />
        <span>
          <span className={styles.fieldName}>Phone <small>(Optional)</small></span>
          <input name={preview ? undefined : "phone"} type="tel" autoComplete={preview ? "off" : "tel"} maxLength={32} />
        </span>
      </label>
      <label className={styles.field}>
        <GraduationCap size={27} aria-hidden="true" />
        <span>
          <span className={styles.fieldName}>Last Course <small>(Optional)</small></span>
          <input name={preview ? undefined : "lastCourse"} type="text" maxLength={120} />
        </span>
      </label>

      <details className={styles.expertise}>
        <summary className={styles.field}>
          <Flower2 size={26} aria-hidden="true" />
          <span className={styles.fieldName}>
            Courses &amp; Expertise
            <small>{selected.length ? `${selected.length} selected` : "Select all that apply"}</small>
          </span>
          <ChevronDown size={23} aria-hidden="true" className={styles.chevron} />
        </summary>
        <div className={styles.choices}>
          {expertiseGroups.map(group => (
            <fieldset key={group.name}>
              <legend>{group.name}</legend>
              <div>
                {group.options.map(option => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      name="expertise"
                      value={option}
                      checked={selected.includes(option)}
                      onChange={event => {
                        const checked = event.currentTarget.checked;
                        setSelected(current => checked ? [...current, option] : current.filter(value => value !== option));
                      }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </details>
    </>
  );
}
