"use client";

import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import type { PortalEvent } from "../../lib/teacher-data";
import { sevaSkills } from "../../lib/signup-profile";
import { directoryAvailability, type DirectoryFilter } from "../../lib/volunteer-directory";
import styles from "./directory.module.css";

export function DirectoryFilters({ filter, events }: { filter: DirectoryFilter; events: Pick<PortalEvent, "id" | "title">[] }) {
  return (
    <form className={styles.filters} action="/teacher" role="search" aria-label="Find volunteers">
      <input type="hidden" name="view" value="find" />
      <div className={styles.search}>
        <button type="submit" aria-label="Search volunteers"><Search size={24} aria-hidden="true" /></button>
        <input type="search" aria-label="Search by name, skill, or interest" name="q" defaultValue={filter.q}
          placeholder="Search by name, skill, or interest" maxLength={80} />
      </div>
      <div className={styles.toolbar}>
        <div className={styles.pill} data-active={!!filter.skill}>
          <select name="skill" aria-label="Skills" defaultValue={filter.skill}
            onChange={event => event.currentTarget.form?.requestSubmit()}>
            <option value="">Skills</option>
            {sevaSkills.map(skill => <option key={skill}>{skill}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <div className={styles.pill} data-active={!!filter.availability}>
          <select name="availability" aria-label="Availability" defaultValue={filter.availability}
            onChange={event => event.currentTarget.form?.requestSubmit()}>
            <option value="">Availability</option>
            {Object.entries(directoryAvailability).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <details className={styles.filterMenu} name="directory-menu">
          <summary className={styles.pill} data-active={!!filter.city} aria-label={filter.city ? `Location, ${filter.city}` : "Location"}>
            <span>{filter.city || "Location"}</span><ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className={styles.popover}>
            <label htmlFor="directory-city">City or area</label>
            <input id="directory-city" name="city" placeholder="e.g. Toronto" maxLength={80} defaultValue={filter.city} />
            <button type="submit" className={styles.apply}>Apply location</button>
          </div>
        </details>
        <details className={styles.filterMenu} name="directory-menu">
          <summary className={styles.filterIcon} data-active={!!filter.forEvent} aria-label="Event options">
            <SlidersHorizontal size={20} aria-hidden="true" />
          </summary>
          <div className={styles.popover}>
            <label htmlFor="invite-event">Invite to an event</label>
            <select id="invite-event" name="forEvent" defaultValue={filter.forEvent} disabled={events.length === 0}>
              <option value="">Choose an event</option>
              {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
            {events.length ? <button type="submit" className={styles.apply}>Apply event</button>
              : <p>Create an event to invite volunteers.</p>}
          </div>
        </details>
      </div>
    </form>
  );
}
