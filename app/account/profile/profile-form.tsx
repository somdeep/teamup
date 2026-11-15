"use client";

import { useActionState } from "react";
import { ArrowRight, Clock3, GraduationCap, MapPin, Phone, UserRound } from "lucide-react";
import type { EditableAccountProfile } from "../../../lib/account-profile";
import { eventTimeZones } from "../../../lib/teacher-event";
import signup from "../../sign-up/sign-up.module.css";
import { saveAccountProfile } from "./actions";
import styles from "./profile.module.css";

export function AccountProfileForm({ profile }: { profile: EditableAccountProfile }) {
  const [state, save, pending] = useActionState(saveAccountProfile, {});
  return <form className={signup.form} action={save}>
    <label className={`${signup.field} ${styles.field}`}>
      <UserRound aria-hidden="true" size={24} />
      <span><span className={signup.fieldName}>Full Name</span>
        <input name="fullName" required maxLength={100} defaultValue={profile.display_name} autoComplete="name" /></span>
    </label>
    <label className={`${signup.field} ${styles.field}`}>
      <Phone aria-hidden="true" size={24} />
      <span><span className={signup.fieldName}>Phone <small>(Optional)</small></span>
        <input name="phone" type="tel" maxLength={32} defaultValue={profile.contact_phone ?? ""} autoComplete="tel" /></span>
    </label>
    <label className={`${signup.field} ${styles.field}`}>
      <MapPin aria-hidden="true" size={24} />
      <span><span className={signup.fieldName}>City or Area</span>
        <input name="city" required maxLength={100} defaultValue={profile.city ?? ""} autoComplete="address-level2" placeholder="e.g. Toronto" /></span>
    </label>
    <label className={`${signup.field} ${styles.field}`}>
      <Clock3 aria-hidden="true" size={24} />
      <span><span className={signup.fieldName}>Time Zone</span>
        <select name="timezone" required defaultValue={profile.timezone ?? "America/Toronto"}>
          {eventTimeZones.map(([value, label]) => <option key={value} value={value}>{label} · {value}</option>)}
        </select></span>
    </label>
    <label className={`${signup.field} ${styles.field}`}>
      <GraduationCap aria-hidden="true" size={24} />
      <span><span className={signup.fieldName}>Last Course <small>(Optional)</small></span>
        <input name="lastCourse" maxLength={120} defaultValue={profile.last_course ?? ""} /></span>
    </label>
    {state.error && <p className={signup.error} role="alert">{state.error}</p>}
    <button className="landing-button primary" disabled={pending}>
      {pending ? "Saving…" : "Save Profile"} <ArrowRight aria-hidden="true" size={21} />
    </button>
  </form>;
}
