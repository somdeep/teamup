"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Calendar, CalendarDays, CalendarSync, Check, ChevronDown } from "lucide-react";
import type { SevaAvailability } from "../../lib/seva-preferences";
import { EmergencySevaSwitch, SpecificDates } from "../about-you/availability-fields";
import signup from "../sign-up/sign-up.module.css";
import { saveMyAvailability } from "./actions";
import styles from "./availability.module.css";

const tiles = [
  { label: "Weekdays", icon: Calendar },
  { label: "Weekends", icon: Calendar },
  { label: "Flexible", icon: CalendarSync },
] as const;

export function MyAvailabilityForm({ profile }: { profile: SevaAvailability & { availability_reviewed: boolean } }) {
  const [state, save, pending] = useActionState(saveMyAvailability, {});
  const [selected, setSelected] = useState(profile.availability);
  const [dates, setDates] = useState(profile.dates.length ? profile.dates : [""]);
  const [emergency, setEmergency] = useState(profile.emergency);
  const dateCount = new Set(dates.filter(Boolean)).size;

  function toggle(option: string, checked: boolean) {
    setSelected(current => checked ? [...current, option] : current.filter(value => value !== option));
  }

  return (
    <form className={`${signup.form} ${styles.form}`} action={save}>
      <fieldset className={styles.general}>
        <legend className="sr-only">General availability</legend>
        <div className={styles.tiles}>
          {tiles.map(({ label, icon: Icon }) => (
            <label key={label} className={styles.tile}>
              <input className="sr-only" type="checkbox" name="availability" value={label} checked={selected.includes(label)}
                onChange={event => toggle(label, event.currentTarget.checked)} />
              <span className={styles.badge} aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              <Icon aria-hidden="true" className={styles.calendar} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className={styles.evenings}>
          <input type="checkbox" name="availability" value="Evenings" checked={selected.includes("Evenings")}
            onChange={event => toggle("Evenings", event.currentTarget.checked)} />
          Evenings
        </label>
      </fieldset>

      <details className={styles.dates} open={profile.dates.length > 0}>
        <summary>
          <CalendarDays aria-hidden="true" size={24} />
          <span>Select Specific Dates</span>
          {dateCount > 0 && <small>{dateCount} selected</small>}
          <ChevronDown aria-hidden="true" size={20} className={styles.chevron} />
        </summary>
        <SpecificDates dates={dates} onChange={setDates} />
        {dateCount > 0 && <input type="hidden" name="availability" value="Specific Dates" />}
      </details>

      <EmergencySevaSwitch checked={emergency} onChange={setEmergency} className={styles.emergency}
        description="I’m open to urgent or last-minute help." />

      {state.error && <p className={signup.error} role="alert">{state.error}</p>}
      <button className={`landing-button primary ${styles.save}`} disabled={pending}>
        {pending ? "Saving…" : profile.availability_reviewed ? "Save Availability" : "Save My Profile"}
        <ArrowRight aria-hidden="true" size={23} />
      </button>
    </form>
  );
}
