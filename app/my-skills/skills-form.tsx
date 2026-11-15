"use client";

import { useActionState, useState } from "react";
import {
  ArrowRight, Camera, CarFront, Check, ChefHat, ChevronDown, CirclePlus, ConciergeBell, Flower2,
  Laptop, Music2, Sprout, Video, type LucideIcon,
} from "lucide-react";
import { sevaSkills } from "../../lib/signup-profile";
import type { SevaSkills } from "../../lib/seva-preferences";
import signup from "../sign-up/sign-up.module.css";
import { saveMySkills } from "./actions";
import styles from "./skills.module.css";

const tiles = [
  { label: "Photography", skill: "Photography", icon: Camera },
  { label: "Decoration", skill: "Decor", icon: Flower2 },
  { label: "Music", skill: "Music & bhajans", icon: Music2 },
  { label: "Tech", skill: "Tech & AV", icon: Laptop },
  { label: "Driving", skill: "Driving", icon: CarFront },
  { label: "Hospitality", skill: "Greeting & hospitality", icon: ConciergeBell },
  { label: "Media", skill: "Social media", icon: Video },
  { label: "Cooking", skill: "Kitchen seva", icon: ChefHat },
] as const satisfies ReadonlyArray<{ label: string; skill: (typeof sevaSkills)[number]; icon: LucideIcon }>;

const otherSkills = sevaSkills.filter(skill => !tiles.some(tile => tile.skill === skill));

function updateSelection(values: string[], skill: string, checked: boolean) {
  return checked ? [...values, skill] : values.filter(value => value !== skill);
}

function AdditionalChoices({ name, label, options, selected, onChange }: {
  name: "skills" | "interests";
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className={styles.choices}>
      <legend className="sr-only">{label}</legend>
      {options.map(skill => (
        <label key={skill}>
          <input type="checkbox" name={name} value={skill} checked={selected.includes(skill)}
            onChange={event => onChange(updateSelection(selected, skill, event.currentTarget.checked))} />
          {skill}
        </label>
      ))}
    </fieldset>
  );
}

export function MySkillsForm({ profile }: { profile: SevaSkills & { skills_reviewed: boolean } }) {
  const [state, save, pending] = useActionState(saveMySkills, {});
  const [skills, setSkills] = useState(profile.skills);
  const [interests, setInterests] = useState(profile.interests);

  return (
    <form className={`${signup.form} ${styles.form}`} action={save}>
      <fieldset className={styles.skills}>
        <legend className="sr-only">Skills you can contribute</legend>
        {tiles.map(({ label, skill, icon: Icon }) => (
          <label key={skill} className={styles.tile}>
            <input className="sr-only" type="checkbox" name="skills" value={skill} checked={skills.includes(skill)}
              onChange={event => setSkills(updateSelection(skills, skill, event.currentTarget.checked))} />
            <span className={styles.tileContent}>
              <Icon aria-hidden="true" className={styles.icon} strokeWidth={2.2} />
              <span>{label}</span>
              <Check aria-hidden="true" size={14} className={styles.check} />
            </span>
          </label>
        ))}
      </fieldset>

      <details className={styles.expander} open={otherSkills.some(skill => profile.skills.includes(skill))}>
        <summary className={styles.other}><CirclePlus aria-hidden="true" size={25} />Add Other Skills</summary>
        <AdditionalChoices name="skills" label="Other skills" options={otherSkills} selected={skills} onChange={setSkills} />
      </details>

      <details className={styles.expander} open={profile.interests.length > 0}>
        <summary className={styles.learning}>
          <Sprout aria-hidden="true" size={28} /><span>I Want to Learn</span><ChevronDown aria-hidden="true" size={21} />
        </summary>
        <AdditionalChoices name="interests" label="Learning interests" options={sevaSkills} selected={interests} onChange={setInterests} />
      </details>

      {state.error && <p className={signup.error} role="alert">{state.error}</p>}
      <button className={`landing-button primary ${styles.next}`} disabled={pending}>
        {pending ? "Saving…" : profile.skills_reviewed ? "Save Skills" : "Next"}
        <ArrowRight aria-hidden="true" size={23} />
      </button>
    </form>
  );
}
