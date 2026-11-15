"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { sevaSkills } from "../../lib/signup-profile";
import { eventTimeZones } from "../../lib/teacher-event";
import auth from "../sign-up/sign-up.module.css";
import { createTeacherEvent } from "./actions";
import styles from "./teacher.module.css";

export function TeacherEventForm({ id, priority }: { id: string; priority: boolean }) {
  const [state, save, pending] = useActionState(createTeacherEvent, {});
  return (
    <form action={save} className={styles.stack}>
      <input type="hidden" name="eventId" value={id} />
      {priority && <input type="hidden" name="priority" value="on" />}
      <label className={styles.field}>Event name<input name="title" required maxLength={120} /></label>
      <div className={styles.two}>
        <label className={styles.field}>Starts<input type="datetime-local" name="startsAt" required /></label>
        <label className={styles.field}>Ends<input type="datetime-local" name="endsAt" required /></label>
      </div>
      <label className={styles.field}>Time zone<select name="timezone" defaultValue="America/Toronto">
        {eventTimeZones.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className={styles.two}>
        <label className={styles.field}>City<input name="city" required maxLength={100} placeholder="Toronto or Online" /></label>
        <label className={styles.field}>Venue (optional)<input name="venue" maxLength={120} /></label>
      </div>
      <fieldset className={styles.skills}>
        <legend>Skills needed</legend>
        {sevaSkills.map(skill => <label key={skill}><input type="checkbox" name="skills" value={skill} />{skill}</label>)}
      </fieldset>
      <label className={styles.field}>Volunteers needed<input type="number" name="volunteers" defaultValue={1} min={1} max={1000} required /></label>
      <label className={styles.field}>Event details (optional)<textarea name="description" rows={4} maxLength={1000} /></label>
      {state.error && <p className={auth.error} role="alert">{state.error}</p>}
      <button className="landing-button primary" disabled={pending}>
        {pending ? "Creating…" : priority ? "Create Priority Event" : "Create Event"}<ArrowRight aria-hidden="true" size={21} />
      </button>
    </form>
  );
}
