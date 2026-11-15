"use client";

import { useId } from "react";
import { Zap } from "lucide-react";
import { maxSpecificDates } from "../../lib/seva-preferences";
import styles from "./about-you.module.css";

export function SpecificDates({ dates, onChange, required = false }: {
  dates: string[];
  onChange: (dates: string[]) => void;
  required?: boolean;
}) {
  return (
    <div className={styles.dates}>
      {dates.map((date, index) => (
        <div key={index}>
          <label>
            Date {index + 1}
            <input type="date" name={required || date ? "dates" : undefined} value={date} required={required}
              onChange={event => {
                const value = event.currentTarget.value;
                onChange(dates.map((previous, position) => position === index ? value : previous));
              }} />
          </label>
          {(dates.length > 1 || (!required && date)) && (
            <button type="button" className={styles.textButton} aria-label={`Remove date ${index + 1}`}
              onClick={() => onChange(dates.length === 1 ? [""] : dates.filter((_, position) => position !== index))}>Remove</button>
          )}
        </div>
      ))}
      {dates.length < maxSpecificDates && (
        <button type="button" className={styles.textButton} onClick={() => onChange([...dates, ""])}>Add another date</button>
      )}
    </div>
  );
}

export function EmergencySevaSwitch({ checked, onChange, description, className = "" }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <label className={`${styles.row} ${styles.emergency} ${className}`}>
      <Zap aria-hidden="true" size={24} />
      <span>
        <span id={`${id}-label`}>Emergency Seva</span>
        {description && <small id={`${id}-description`}>{description}</small>}
      </span>
      <input type="checkbox" role="switch" name="emergency" checked={checked} aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined} onChange={event => onChange(event.currentTarget.checked)} />
    </label>
  );
}
