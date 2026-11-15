"use client";

import Link from "next/link";
import { CalendarDays, Check, Mic, PawPrint, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseFetchIntent } from "../../../lib/fetch/intent";
import type { FetchAnimation, FetchEvent, FetchIntent, FetchMatch } from "../../../lib/fetch/types";
import { searchFetchVolunteers, sendFetchInvitations } from "./actions";
import styles from "./fetch-assistant.module.css";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const videoFor: Record<FetchAnimation, string> = {
  idle: "/fetch/dog-idle.mp4",
  playful: "/fetch/dog-playful.mp4",
  searching: "/fetch/dog-searching.mp4",
  digging: "/fetch/dog-digging.mp4",
  success: "/fetch/dog-playful.mp4",
  "no-results": "/fetch/dog-no-results.mp4",
  sleeping: "/fetch/dog-sleeping.mp4",
  zen: "/fetch/dog-zen.mp4",
};

const quickRequests = [
  ["Singers", "Find 2 singers"],
  ["Photos", "Find photographers"],
  ["Setup help", "Find setup helpers"],
] as const;

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase();
}

function eventLabel(event: FetchEvent) {
  if (!event.starts_at) return event.title;
  const when = new Intl.DateTimeFormat("en-CA", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone,
  }).format(new Date(event.starts_at));
  return `${event.title} · ${when}`;
}

function availabilityLabel(match: FetchMatch) {
  return match.availability === "full-event" ? "Full time match" : "General availability";
}

export function FetchAssistant({ events }: { events: FetchEvent[] }) {
  const [open, setOpen] = useState(false);
  const [animation, setAnimation] = useState<FetchAnimation>("idle");
  const [dogLine, setDogLine] = useState("Hi! I’m Fetch! 🐶");
  const [dogSubline, setDogSubline] = useState("Tell me who you need. Tap me for a little wag!");
  const [query, setQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [intent, setIntent] = useState<FetchIntent | null>(null);
  const [matches, setMatches] = useState<FetchMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("Type your request, or use the microphone in a supported browser.");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const idleIndex = useRef(0);

  const selectedEvent = events.find(event => event.id === selectedEventId) ?? null;
  const accepted = selectedEvent?.invitations.filter(invitation => invitation.status === "accepted").length ?? 0;
  const pending = selectedEvent?.invitations.filter(invitation => invitation.status === "pending").length ?? 0;
  const invitationCapacity = Math.max(0, (selectedEvent?.volunteers_needed ?? 0) - accepted - pending);
  const visibleMatches = useMemo(() => {
    const requested = intent?.quantity ?? 5;
    return matches.slice(0, Math.min(8, Math.max(requested + 3, 5)));
  }, [intent?.quantity, matches]);

  const restoreIdle = useCallback((line = "I’m ready to Fetch! 🐶", subline = "Tell me which helpers you need below.") => {
    setAnimation("idle");
    setDogLine(line);
    setDogSubline(subline);
  }, []);

  const playReaction = useCallback((next: FetchAnimation, line: string, subline: string, duration = 1700) => {
    if (searching || sending) return;
    setAnimation(next);
    setDogLine(line);
    setDogSubline(subline);
    window.setTimeout(() => restoreIdle(), duration);
  }, [restoreIdle, searching, sending]);

  useEffect(() => {
    if (!open || searching || sending || listening || reviewing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      const scenes: Array<[FetchAnimation, string, string]> = [
        ["sleeping", "Fetch is taking a tiny nap… 😴", "Tap me when you need helpers!"],
        ["zen", "A peaceful moment… 🐾", "I’m still here when you’re ready."],
        ["playful", "Wanna play? 🐾", "Tap me or type what you need."],
      ];
      const scene = scenes[idleIndex.current++ % scenes.length];
      playReaction(...scene, 1900);
    }, 17000);
    return () => window.clearTimeout(timer);
  }, [animation, listening, open, playReaction, reviewing, searching, sending]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        recognitionRef.current?.abort();
        setOpen(false);
        window.setTimeout(() => fabRef.current?.focus(), 0);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function openFetch() {
    setOpen(true);
    window.setTimeout(() => textRef.current?.focus(), 100);
  }

  function closeFetch() {
    recognitionRef.current?.abort();
    setListening(false);
    setOpen(false);
    restoreIdle();
    window.setTimeout(() => fabRef.current?.focus(), 0);
  }

  function chooseEvent(eventId: string) {
    setSelectedEventId(eventId);
    setIntent(null);
    setMatches([]);
    setSelected([]);
    setReviewing(false);
    setError(null);
    setSuccess(null);
    setNotice("Event changed. Ask Fetch who you need.");
  }

  async function runSearch(request = query) {
    if (searching || sending) return;
    const parsed = parseFetchIntent(request, events, selectedEventId);
    setIntent(parsed);
    setError(null);
    setSuccess(null);
    setReviewing(false);
    setSelected([]);
    if (parsed.eventId && parsed.eventId !== selectedEventId) setSelectedEventId(parsed.eventId);
    if (parsed.clarification) {
      setMatches([]);
      setTotal(0);
      setError(parsed.clarification);
      setAnimation("no-results");
      setDogLine("I need one more clue. 🐾");
      setDogSubline(parsed.clarification);
      window.setTimeout(() => restoreIdle(), 2500);
      return;
    }

    setSearching(true);
    setMatches([]);
    setTotal(0);
    setNotice("Checking actual TeamUp skills and availability…");
    setAnimation("searching");
    setDogLine("On my way! 🐾");
    setDogSubline("Checking skills and the selected event time.");
    try {
      const resultPromise = searchFetchVolunteers(parsed);
      await wait(450);
      setAnimation("digging");
      setDogLine("Sniff sniff…");
      setDogSubline("Separating full schedule matches from general preferences.");
      const result = await resultPromise;
      await wait(350);
      if (!result.ok) throw new Error(result.error ?? "Fetch couldn’t complete the search.");
      setMatches(result.matches);
      setTotal(result.total);
      if (result.matches.length) {
        setAnimation("success");
        setDogLine("Woof! I found your helpers! 🎉");
        setDogSubline("Review availability, choose volunteers, then confirm invitations.");
        setNotice(`Found ${result.total} relevant volunteer${result.total === 1 ? "" : "s"}.`);
        window.setTimeout(() => setAnimation("idle"), 1800);
      } else {
        setAnimation("no-results");
        setDogLine("No matches this time. 🐾");
        setDogSubline("Try another approved skill or a different event.");
        setNotice("No matching volunteers were returned for this event.");
        window.setTimeout(() => setAnimation("idle"), 2500);
      }
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "Fetch couldn’t complete the search.";
      setError(message);
      setAnimation("no-results");
      setDogLine("Something went wrong. 🐾");
      setDogSubline("No fictional results were substituted. Please try again.");
      setNotice("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function togglePerson(personId: string) {
    setSelected(current => current.includes(personId)
      ? current.filter(id => id !== personId)
      : [...current, personId]);
  }

  async function confirmInvitations() {
    if (!selectedEvent || !selected.length || sending) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendFetchInvitations(selectedEvent.id, selected);
      if (!result.ok && !result.sent.length && !result.alreadyInvited.length) throw new Error(result.error ?? "Invitations could not be sent.");
      const affected = new Set([...result.sent, ...result.alreadyInvited]);
      setMatches(current => current.map(match => affected.has(match.personId)
        ? { ...match, invitationStatus: "pending" }
        : match));
      const sentText = result.sent.length
        ? `${result.sent.length} invitation${result.sent.length === 1 ? " was" : "s were"} sent. Responses are pending.`
        : "Those volunteers already have invitations for this event.";
      setSuccess(sentText);
      if (result.error) setError(result.error);
      setReviewing(false);
      setSelected([]);
      setAnimation("success");
      setDogLine("Invitations sent! 🐾");
      setDogSubline("They are requests—not confirmations—until each volunteer accepts.");
      setNotice(sentText);
      window.setTimeout(() => setAnimation("idle"), 2000);
    } catch (inviteError) {
      const message = inviteError instanceof Error ? inviteError.message : "Invitations could not be sent.";
      setError(message);
      setNotice("No invitations were sent.");
    } finally {
      setSending(false);
    }
  }

  function startVoice() {
    if (listening) {
      recognitionRef.current?.abort();
      setListening(false);
      setNotice("Listening stopped. You can edit the text before searching.");
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("Voice input isn’t supported in this browser. Type your request instead.");
      textRef.current?.focus();
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-CA";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalText = "";
    recognition.onstart = () => {
      setListening(true);
      setNotice("Listening… speak your request.");
    };
    recognition.onresult = event => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += `${transcript} `;
        else interim += transcript;
      }
      const heard = `${finalText}${interim}`.trim();
      setQuery(heard);
      setNotice(`Heard: ${heard}`);
    };
    recognition.onerror = event => {
      setNotice(event.error === "not-allowed"
        ? "Microphone permission was denied. Type your request instead."
        : "Voice input stopped. Type your request or try again.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (!finalText.trim()) setNotice("Review what Fetch heard, or type your request.");
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
      setNotice("Voice input couldn’t start. Type your request instead.");
    }
  }

  const video = (compact = false) => <video
    key={`${compact ? "fab" : "panel"}-${animation}`}
    src={videoFor[animation]}
    poster="/fetch/fetch-avatar.jpg"
    autoPlay muted playsInline
    loop={animation === "idle" || animation === "searching"}
    aria-hidden="true"
    className={animation === "searching" || animation === "sleeping" ? styles.lightVideo : undefined}
  />;

  return <>
    <button type="button" className={styles.launcherTile} onClick={openFetch}>
      <PawPrint aria-hidden="true" size={32} strokeWidth={2.4} />
      <span>Ask Fetch</span>
      <small>Find volunteers</small>
    </button>

    <div className={styles.fabWrap}>
      {!open && <div className={styles.fabHint}>Need a helping paw?<small>Tap Fetch to ask</small></div>}
      <button ref={fabRef} type="button" className={styles.fab} onClick={open ? closeFetch : openFetch}
        aria-label={open ? "Close Fetch assistant" : "Open Fetch assistant"} aria-expanded={open} aria-controls="fetch-assistant">
        {video(true)}
      </button>
    </div>

    <section id="fetch-assistant" role="dialog" aria-modal="false" aria-label="Fetch volunteer assistant"
      aria-hidden={!open} className={`${styles.panel} ${open ? styles.open : ""}`}>
      <header className={styles.panelHeader}>
        <span className={styles.paw}><PawPrint aria-hidden="true" size={20} /></span>
        <span><strong>Fetch 🐶</strong><small>Your friendly volunteer finder</small></span>
        <button type="button" className={styles.close} onClick={closeFetch} aria-label="Close Fetch assistant"><X aria-hidden="true" /></button>
      </header>

      <div className={styles.scrollArea}>
        <div className={`${styles.character} ${searching ? styles.characterSearching : ""} ${matches.length ? styles.characterWithResults : ""}`}>
          <button type="button" className={styles.petDog}
            onClick={() => playReaction("playful", "Yay, you found me! 🐾", "Tell me which helpers you need below.")}
            disabled={searching || sending} aria-label="Tap Fetch to see him play">
            <span className={styles.dogSpotlight}>{video()}</span>
          </button>
          <p className={styles.bubble} aria-live="polite"><strong>{dogLine}</strong><small>{dogSubline}</small></p>
        </div>

        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void runSearch(); }}>
          <label htmlFor="fetch-query">Who do you need for your event?</label>
          <textarea ref={textRef} id="fetch-query" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="I need 3 singers for Satsang…" maxLength={350} disabled={searching || sending} />
          <div className={styles.composeActions}>
            <button type="button" className={`${styles.mic} ${listening ? styles.listening : ""}`} onClick={startVoice}
              aria-label={listening ? "Stop listening" : "Speak to Fetch"} disabled={searching || sending}>
              <Mic aria-hidden="true" size={19} />
            </button>
            <button type="submit" className={styles.askButton} disabled={searching || sending || !events.length}>
              {searching ? "Fetching…" : "Ask Fetch"} <PawPrint aria-hidden="true" size={17} />
            </button>
          </div>
        </form>
        <p className={styles.voiceStatus} role="status">{notice}</p>

        {!matches.length && !searching && <div className={styles.quickRequests} aria-label="Quick volunteer searches">
          {quickRequests.map(([label, request]) => <button key={label} type="button" onClick={() => { setQuery(request); void runSearch(request); }}>
            {label}
          </button>)}
        </div>}

        <label className={styles.eventPicker}>
          <span><CalendarDays aria-hidden="true" size={16} /> Event</span>
          <select value={selectedEventId} onChange={event => chooseEvent(event.target.value)} disabled={searching || sending || !events.length}>
            {events.length
              ? events.map(event => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)
              : <option value="">No upcoming manageable events</option>}
          </select>
        </label>

        {intent && !intent.clarification && <div className={styles.interpretation} aria-label="Fetch interpretation">
          <strong>Fetch understood</strong>
          <div>
            <span>{intent.eventTitle}</span>
            {intent.skills.map(skill => <span key={skill}>{skill}</span>)}
            <span>{intent.quantity ? `${intent.quantity} requested` : "Show best matches"}</span>
            {intent.urgentOnly && <span>Last-minute seva only</span>}
          </div>
        </div>}

        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && <p className={styles.success} role="status"><Check aria-hidden="true" size={17} /> {success}</p>}

        {(matches.length > 0 || searching || intent && !intent.clarification && !error) && <section className={styles.results} aria-live="polite" aria-busy={searching}>
          <header><h3>{searching ? "Fetch is searching…" : "Volunteer matches"}</h3>
            {!searching && <span>{total} found</span>}
          </header>
          {!searching && <p className={styles.resultNote}>
            {intent?.quantity ? `${intent.quantity} requested. Showing the strongest matches plus alternates. ` : ""}
            Matches are not confirmed volunteers; a person is confirmed only after accepting.
          </p>}

          {!searching && visibleMatches.map(match => {
            const unavailableForSelection = match.invitationStatus !== null;
            return <label key={match.personId} className={styles.person}>
              <input type="checkbox" checked={selected.includes(match.personId)} onChange={() => togglePerson(match.personId)}
                disabled={unavailableForSelection || sending} aria-label={`Select ${match.fullName}`} />
              <span className={styles.avatar}>{initials(match.fullName)}</span>
              <span className={styles.personInfo}>
                <Link href={`/teacher?view=find&forEvent=${selectedEventId}&person=${match.personId}`}>{match.fullName}</Link>
                <small>{match.matchedSkills.join(", ")}{match.city ? ` · ${match.city}` : ""}</small>
                <small>{match.availability === "full-event"
                  ? "Scheduled availability covers this full event"
                  : "General preference; confirm availability before inviting"}</small>
              </span>
              <span className={`${styles.matchBadge} ${match.availability === "general-preference" ? styles.softBadge : ""}`}>
                {match.invitationStatus ?? availabilityLabel(match)}
              </span>
            </label>;
          })}

          {!searching && matches.length > visibleMatches.length && <p className={styles.moreMatches}>
            {matches.length - visibleMatches.length} more match{matches.length - visibleMatches.length === 1 ? "" : "es"} available. Refine the request to narrow the list.
          </p>}

          {!searching && !reviewing && <div className={styles.inviteBar}>
            <span><strong>{selected.length} selected</strong><small>{invitationCapacity} invitation spot{invitationCapacity === 1 ? "" : "s"} open</small></span>
            <button type="button" onClick={() => setReviewing(true)}
              disabled={!selected.length || selected.length > invitationCapacity}>Review invitations</button>
          </div>}

          {!searching && reviewing && selectedEvent && <div className={styles.review} role="group" aria-label="Review volunteer invitations">
            <strong>Confirm invitations to {selectedEvent.title}</strong>
            <p>{selected.map(id => matches.find(match => match.personId === id)?.fullName).filter(Boolean).join(", ")}</p>
            <small>Sending creates pending requests. It does not mark anyone as confirmed.</small>
            <div><button type="button" className={styles.backButton} onClick={() => setReviewing(false)} disabled={sending}>Go back</button>
              <button type="button" className={styles.confirmButton} onClick={() => void confirmInvitations()} disabled={sending}>
                {sending ? "Sending…" : "Confirm and send"} <Send aria-hidden="true" size={15} />
              </button></div>
          </div>}
        </section>}

        {!events.length && <div className={styles.emptyEvents}>
          <Sparkles aria-hidden="true" />
          <p>Fetch works with an upcoming event you manage.</p>
          <Link href="/teacher?view=create">Create an event</Link>
        </div>}
      </div>
      <footer className={styles.footer}>Fetch uses your signed-in TeamUp teacher access and existing event permissions.</footer>
    </section>
  </>;
}
