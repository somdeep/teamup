"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, Heart, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { sevaSkills } from "../../lib/signup-profile";
import type { OpportunityFilter } from "../../lib/volunteer-opportunities";
import styles from "./volunteer.module.css";

export function OpportunityFilters({ filter }: { filter: OpportunityFilter }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openFilters = () => dialog.current?.showModal();
  const dateLabel = filter.date === "7" ? "Next 7 days" : filter.date === "30" ? "Next 30 days" : "Date";
  const hasFilters = Boolean(filter.q || filter.skill || filter.city || filter.date || filter.saved);

  return <form action="/volunteer" className={styles.browseFilters} role="search" aria-label="Browse seva opportunities">
    <input type="hidden" name="view" value="opportunities" />
    <label className={styles.browseSearch}>
      <Search aria-hidden="true" />
      <span className="sr-only">Search opportunities</span>
      <input name="q" defaultValue={filter.q} maxLength={80} placeholder="Search by event, skill or keyword" />
    </label>
    <div className={styles.filterRow}>
      <Link className={styles.allFilter} data-active={!hasFilters} href="/volunteer?view=opportunities">All</Link>
      <Link className={styles.savedFilter} data-active={filter.saved}
        href={filter.saved ? "/volunteer?view=opportunities" : "/volunteer?view=opportunities&saved=1"}>
        <Heart aria-hidden="true" fill={filter.saved ? "currentColor" : "none"} />Saved
      </Link>
      <button className={styles.filterChip} type="button" onClick={openFilters} aria-haspopup="dialog">
        <span>{filter.skill || "Skill"}</span><ChevronDown aria-hidden="true" />
      </button>
      <button className={styles.filterChip} type="button" onClick={openFilters} aria-haspopup="dialog">
        <CalendarDays aria-hidden="true" /><span>{dateLabel}</span><ChevronDown aria-hidden="true" />
      </button>
      <button className={styles.filterChip} type="button" onClick={openFilters} aria-haspopup="dialog">
        <MapPin aria-hidden="true" /><span>{filter.city || "Location"}</span>
      </button>
      <button className={styles.applyFilters} type="button" onClick={openFilters} aria-haspopup="dialog" aria-label="Open opportunity filters">
        <SlidersHorizontal aria-hidden="true" />
      </button>
    </div>

    <dialog ref={dialog} className={styles.filterDialog} aria-labelledby="opportunity-filter-title">
      <div className={styles.filterDialogHeader}>
        <h2 id="opportunity-filter-title">Filter opportunities</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close filters"><X aria-hidden="true" /></button>
      </div>
      <label><span>Skill</span><select name="skill" defaultValue={filter.skill}>
        <option value="">All skills</option>
        {sevaSkills.map(skill => <option key={skill}>{skill}</option>)}
      </select></label>
      <label><span>Date</span><select name="date" defaultValue={filter.date}>
        <option value="">Any upcoming date</option>
        <option value="7">Next 7 days</option>
        <option value="30">Next 30 days</option>
      </select></label>
      <label><span>Location</span><input name="city" defaultValue={filter.city} maxLength={80} placeholder="City or Online" /></label>
      <label className={styles.savedCheckbox}><input type="checkbox" name="saved" value="1" defaultChecked={filter.saved} />
        <span>Only show saved seva</span></label>
      <div className={styles.filterDialogActions}>
        <Link href="/volunteer?view=opportunities">Clear</Link>
        <button type="submit">Apply filters</button>
      </div>
    </dialog>
  </form>;
}
