import Link from "next/link";
import {
  BookOpen, CalendarCheck2, CalendarClock, CalendarDays, ChevronRight,
  History, Music2, Sprout, UsersRound,
} from "lucide-react";
import { formatEventTime } from "../../lib/teacher-event";
import type { VolunteerInvitation } from "../../lib/volunteer-data";
import { cancelCommitment, respondToOpportunity } from "./actions";
import styles from "./volunteer.module.css";

const tools = [
  { href: "/volunteer?view=opportunities", name: "Find Seva Opportunities", icon: CalendarCheck2, tone: "orange" },
  { href: "/volunteer?view=commitments", name: "My Commitments", icon: UsersRound, tone: "gold" },
  { href: "/volunteer?view=history", name: "My Seva History", icon: History, tone: "orange" },
  { href: "/my-skills", name: "My Skills & Interests", icon: Sprout, tone: "green" },
  { href: "/volunteer?view=resources", name: "Learning & Resources", icon: BookOpen, tone: "orange" },
] as const;

export function VolunteerTiles() {
  return <nav className={styles.tiles} aria-label="Volunteer tools">
    {tools.map(({ href, name, icon: Icon, tone }) => <Link className={styles.tile} href={href} key={href} data-tone={tone}>
      <Icon aria-hidden="true" strokeWidth={2.15} />
      <span>{name}</span>
    </Link>)}
  </nav>;
}

function EventIcon({ invitation }: { invitation: VolunteerInvitation }) {
  const text = `${invitation.events?.title ?? ""} ${invitation.events?.category ?? ""}`.toLowerCase();
  return text.includes("satsang") || text.includes("music")
    ? <Music2 aria-hidden="true" />
    : <CalendarDays aria-hidden="true" />;
}

export function VolunteerEventRows({ invitations, compact = false }: {
  invitations: VolunteerInvitation[];
  compact?: boolean;
}) {
  if (!invitations.length) return <p className={styles.empty}>No upcoming opportunities yet.</p>;
  return <ul className={styles.eventStack}>{invitations.map(invitation => {
    const event = invitation.events;
    if (!event) return null;
    const href = invitation.status === "accepted" ? `/events/${event.id}` : "/volunteer?view=opportunities";
    return <li key={invitation.id}>
      <Link className={styles.eventRow} href={href}>
        <span className={styles.eventIcon}><EventIcon invitation={invitation} /></span>
        <span className={styles.eventCopy}>
          <strong>{event.title}</strong>
          <small><CalendarClock aria-hidden="true" /> {formatEventTime(event)}</small>
          {!compact && event.city && <small>{event.city}</small>}
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>
    </li>;
  })}</ul>;
}

export function OpportunityList({ invitations }: { invitations: VolunteerInvitation[] }) {
  if (!invitations.length) return <p className={styles.empty}>New seva opportunities shared with you will appear here.</p>;
  return <ul className={styles.cardStack}>{invitations.map(invitation => {
    const event = invitation.events;
    if (!event) return null;
    return <li className={styles.opportunityCard} key={invitation.id}>
      <span className={styles.cardIcon}><EventIcon invitation={invitation} /></span>
      <div className={styles.cardCopy}>
        <h2>{event.title}</h2>
        <p>{formatEventTime(event)}{event.city && ` · ${event.city}`}</p>
        {event.description && <p>{event.description}</p>}
      </div>
      <form action={respondToOpportunity} className={styles.responseActions}>
        <input type="hidden" name="invitationId" value={invitation.id} />
        <button className={styles.accept} name="response" value="accepted">Accept</button>
        <button className={styles.decline} name="response" value="declined">Decline</button>
      </form>
    </li>;
  })}</ul>;
}

export function CommitmentList({ invitations }: { invitations: VolunteerInvitation[] }) {
  if (!invitations.length) return <p className={styles.empty}>Accepted seva commitments will appear here.</p>;
  return <ul className={styles.cardStack}>{invitations.map(invitation => {
    const event = invitation.events;
    if (!event) return null;
    return <li className={styles.opportunityCard} key={invitation.id}>
      <span className={styles.cardIcon}><EventIcon invitation={invitation} /></span>
      <div className={styles.cardCopy}>
        <h2>{event.title}</h2>
        <p>{formatEventTime(event)}{event.city && ` · ${event.city}`}</p>
      </div>
      <div className={styles.commitmentActions}>
        <Link href={`/events/${event.id}`}>Open Event Circle</Link>
        <form action={cancelCommitment}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <button>Cancel commitment</button>
        </form>
      </div>
    </li>;
  })}</ul>;
}

export function SevaHistory({ invitations }: { invitations: VolunteerInvitation[] }) {
  if (!invitations.length) return <p className={styles.empty}>Your completed seva will appear here.</p>;
  return <ul className={styles.cardStack}>{invitations.map(invitation => {
    const event = invitation.events;
    return event && <li className={styles.historyRow} key={invitation.id}>
      <span className={styles.cardIcon}><EventIcon invitation={invitation} /></span>
      <span><strong>{event.title}</strong><small>{formatEventTime(event)}{event.city && ` · ${event.city}`}</small></span>
    </li>;
  })}</ul>;
}
