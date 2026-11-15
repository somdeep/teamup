"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Camera, ChevronDown, Heart, Sprout, UserRound } from "lucide-react";
import { sevaSkills } from "../../lib/signup-profile";
import { availabilityOptions, maxPhotoBytes, type SevaProfile } from "../../lib/seva-preferences";
import signup from "../sign-up/sign-up.module.css";
import { saveAboutYou } from "./actions";
import { EmergencySevaSwitch, SpecificDates } from "./availability-fields";
import styles from "./about-you.module.css";

const acceptedPhotos = ["image/jpeg", "image/png", "image/webp"];

async function preparePhoto(source: File) {
  const image = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    const sourceSize = Math.min(image.width, image.height);
    canvas.width = canvas.height = Math.min(sourceSize, 480);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (image.width - sourceSize) / 2, (image.height - sourceSize) / 2,
      sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size > maxPhotoBytes) throw new Error("Could not size the photo");
    return new File([blob], "profile.jpg", { type: "image/jpeg" });
  } finally {
    image.close();
  }
}

function ChoiceGroup({ name, label, options, selected, onChange }: {
  name: string;
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <fieldset className={styles.choices}>
      <legend className="sr-only">{label}</legend>
      {options.map(option => (
        <label key={option}>
          <input type="checkbox" name={name} value={option} checked={selected.includes(option)}
            onChange={event => onChange(event.currentTarget.checked ? [...selected, option] : selected.filter(value => value !== option))} />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

export function AboutYouForm({ profile }: { profile: SevaProfile }) {
  const [state, save, pending] = useActionState(saveAboutYou, {});
  const [skills, setSkills] = useState(profile.skills.filter(skill => sevaSkills.some(option => option === skill)));
  const [interests, setInterests] = useState(profile.interests.filter(skill => sevaSkills.some(option => option === skill)));
  const [availability, setAvailability] = useState(profile.availability);
  const [dates, setDates] = useState(profile.dates.length ? profile.dates : [""]);
  const [emergency, setEmergency] = useState(profile.emergency);
  const [photo, setPhoto] = useState<{ file: File; url: string }>();
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (photo) return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    if (!acceptedPhotos.includes(file.type) || file.size > 12 * 1024 * 1024) {
      setPhotoError("Choose a JPEG, PNG, or WebP photo up to 12 MB.");
      return;
    }
    setPhotoError("");
    setPreparing(true);
    try {
      const prepared = await preparePhoto(file);
      setPhoto({ file: prepared, url: URL.createObjectURL(prepared) });
      setRemovePhoto(false);
    } catch {
      setPhotoError("We couldn’t open that photo. Choose another image.");
    } finally {
      setPreparing(false);
    }
  }

  const photoUrl = photo?.url || (profile.has_photo && !removePhoto ? "/about-you/photo" : undefined);

  return (
    <form className={`${signup.form} ${styles.form}`} action={form => {
      if (photo) form.set("photo", photo.file);
      if (removePhoto) form.set("removePhoto", "on");
      save(form);
    }}>
      <input type="hidden" name="role" value={profile.intent} />

      <div>
        <label className={`${styles.row} ${styles.photo}`}>
          <Camera aria-hidden="true" size={23} />
          <span>Photo <small>(Optional)</small></span>
          <input className="sr-only" type="file" accept={acceptedPhotos.join(",")} disabled={preparing || pending}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void choosePhoto(file);
            }} />
          <span className={styles.avatar} aria-hidden="true">
            {photoUrl ? <Image src={photoUrl} alt="" width={44} height={44} unoptimized /> : <UserRound size={28} />}
          </span>
        </label>
        <p className={styles.hint}>If you’re listed in the volunteer directory, teachers can see your photo.</p>
        {preparing && <p className={styles.hint} role="status">Preparing photo…</p>}
        {photoError && <p className={signup.error} role="alert">{photoError}</p>}
        {photoUrl && <button type="button" className={styles.textButton} onClick={() => {
          setPhoto(undefined);
          setRemovePhoto(profile.has_photo);
          setPhotoError("");
        }}>Remove photo</button>}
      </div>

      <details className={styles.section}>
        <summary className={styles.row}><Heart aria-hidden="true" size={23} /><span>My Skills</span><ChevronDown aria-hidden="true" size={20} /></summary>
        <ChoiceGroup name="skills" label="My Skills" options={sevaSkills} selected={skills} onChange={setSkills} />
      </details>

      <details className={styles.section}>
        <summary className={styles.row}>
          <Sprout aria-hidden="true" size={23} />
          <span>I Want to Learn <small>Skills I’d like to explore.</small></span>
          <ChevronDown aria-hidden="true" size={20} />
        </summary>
        <ChoiceGroup name="interests" label="I Want to Learn" options={sevaSkills} selected={interests} onChange={setInterests} />
      </details>

      <details className={styles.section} open>
        <summary className={styles.row}><CalendarDays aria-hidden="true" size={23} /><span>Availability</span><ChevronDown aria-hidden="true" size={20} /></summary>
        <ChoiceGroup name="availability" label="General availability" options={availabilityOptions} selected={availability} onChange={setAvailability} />
        <p className={styles.hint}>Choose when you’re generally open to helping. Matching uses scheduled time slots.</p>
        {availability.includes("Specific Dates") && <SpecificDates dates={dates} onChange={setDates} required />}
      </details>

      <EmergencySevaSwitch checked={emergency} onChange={setEmergency} />

      {state.error && <p className={signup.error} role="alert">{state.error}</p>}
      <button className={`landing-button primary ${styles.save}`} disabled={pending || preparing}>
        {pending ? "Saving…" : profile.complete ? "Save Preferences" : "Save & Continue"}
        <ArrowRight aria-hidden="true" size={23} />
      </button>
    </form>
  );
}
