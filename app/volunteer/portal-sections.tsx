import Link from "next/link";
import {
  BookOpen, CalendarCheck2, CalendarClock, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardList, Clock3, Download, FileText, History, Mail, MapPin, Music2, Sprout, UsersRound, X,
} from "lucide-react";
import { formatEventTime } from "../../lib/teacher-event";
import type { VolunteerEventResource } from "../../lib/event-resources";
import type { VolunteerInvitation } from "../../lib/volunteer-data";
import {
  cancelApplication, cancelCommitment, cancelRequestCommitment, respondToOpportunity, respondToRequest,
} from "./actions";
import styles from "./volunteer.module.css";

const tools = [
  { href: "/volunteer?view=opportunities", name: "Find Seva Opportunities", icon: CalendarCheck2, tone: "orange" },
  { href: "/volunteer?view=commitments", name: "My Commitments", icon: UsersRound, tone: "gold" },
  { href: "/volunteer?view=history", name: "My Seva History", icon: History, tone: "orange" },
  { href: "/my-skills", name: "My Skills & Interests", icon: Sprout, tone: "green" },
  { href: "/volunteer?view=resources", name: "Learning & Resources", icon: BookOpen, tone: "orange" },
  { href: "/volunteer?view=requests&tab=pending", name: "My Requests", icon: ClipboardList, tone: "orange" },
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
  return <div className={styles.journey}>
    <div className={styles.journeyWave} aria-hidden="true" />
    {!invitations.length && <p className={styles.empty}>Your completed seva will appear here.</p>}
    {invitations.length > 0 && <ul className={styles.journeyCards}>{invitations.map(invitation => {
    const event = invitation.events;
    return event && <li key={invitation.id}>
      <Link className={styles.journeyCard} href={`/events/${event.id}`} aria-label={`Open ${event.title} Event Circle`}>
        <span className={styles.journeyArt}><EventIcon invitation={invitation} /></span>
        <span className={styles.journeyCopy}><strong>{event.title}</strong><small><CalendarDays aria-hidden="true" />{new Intl.DateTimeFormat("en-CA", {
          month: "short", year: "numeric", timeZone: event.timezone,
        }).format(new Date(event.starts_at ?? invitation.invited_at))}</small>
        <small><UsersRound aria-hidden="true" />{invitation.requested_role ?? "Seva volunteer"}</small></span>
        <ChevronRight aria-hidden="true" />
      </Link>
    </li>;
  })}</ul>}
    <Link className={styles.addSeva} href="/volunteer?view=opportunities"><Sprout aria-hidden="true" />Add Seva</Link>
  </div>;
}

export type VolunteerRequestTab = "pending" | "invitations" | "confirmed";

function requestItems(invitations: VolunteerInvitation[], tab: VolunteerRequestTab) {
  if (tab === "pending") return invitations.filter(item => item.status === "pending" && item.request_source === "volunteer_application");
  if (tab === "invitations") return invitations.filter(item => item.status === "pending" && item.request_source === "teacher_invitation");
  return invitations.filter(item => item.status === "accepted");
}

export function VolunteerRequests({ invitations, tab }: {
  invitations: VolunteerInvitation[];
  tab: VolunteerRequestTab;
}) {
  const counts = {
    pending: requestItems(invitations, "pending").length,
    invitations: requestItems(invitations, "invitations").length,
    confirmed: requestItems(invitations, "confirmed").length,
  };
  const items = requestItems(invitations, tab);
  return <div className={styles.requestsPage}>
    <nav className={styles.requestTabs} aria-label="Request status">
      <Link href="/volunteer?view=requests&tab=pending" aria-current={tab === "pending" ? "page" : undefined}>
        <Clock3 aria-hidden="true" /><span>Pending ({counts.pending})</span>
      </Link>
      <Link href="/volunteer?view=requests&tab=invitations" aria-current={tab === "invitations" ? "page" : undefined}>
        <Mail aria-hidden="true" /><span>Invitations ({counts.invitations})</span>
      </Link>
      <Link href="/volunteer?view=requests&tab=confirmed" aria-current={tab === "confirmed" ? "page" : undefined}>
        <CheckCircle2 aria-hidden="true" /><span>Confirmed ({counts.confirmed})</span>
      </Link>
    </nav>
    {!items.length && <p className={styles.empty}>{tab === "pending" ? "Your pending seva applications will appear here."
      : tab === "invitations" ? "New invitations from teachers will appear here."
      : "Your confirmed seva commitments will appear here."}</p>}
    {items.length > 0 && <ul className={styles.requestCards}>{items.map(invitation => {
      const event = invitation.events;
      if (!event) return null;
      return <li key={invitation.id} className={styles.requestCard}>
        <span className={styles.requestArt}><EventIcon invitation={invitation} /></span>
        <div className={styles.requestCopy}>
          <h2>{event.title}</h2>
          <p><CalendarDays aria-hidden="true" /> {formatEventTime(event)}</p>
          {event.city && <p><MapPin aria-hidden="true" /> {event.city}</p>}
          {invitation.requested_role && <p className={styles.requestRole}><Music2 aria-hidden="true" /> {invitation.requested_role}</p>}
        </div>
        <span className={styles.requestStatus} data-kind={tab}>{tab === "pending" ? <><Clock3 aria-hidden="true" />Pending</>
          : tab === "invitations" ? <><Mail aria-hidden="true" />Invitation</>
          : <><CheckCircle2 aria-hidden="true" />Confirmed</>}</span>
        <Link className={styles.requestOpen} href={tab === "confirmed" ? `/events/${event.id}` : `/volunteer?view=opportunity&event=${event.id}`}
          aria-label={`Open ${event.title}`}><ChevronRight aria-hidden="true" /></Link>
        {tab === "invitations" && <form action={respondToRequest} className={styles.requestActions}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <button className={styles.accept} name="response" value="accepted"><CheckCircle2 aria-hidden="true" />Accept</button>
          <button className={styles.decline} name="response" value="declined"><X aria-hidden="true" />Decline</button>
        </form>}
        {tab === "pending" && <form action={cancelApplication} className={styles.requestActions}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <button className={styles.decline}>Cancel application</button>
        </form>}
        {tab === "confirmed" && <form action={cancelRequestCommitment} className={styles.requestActions}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <button className={styles.decline}>Cancel commitment</button>
        </form>}
      </li>;
    })}</ul>}
  </div>;
}

function resourceSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function LearningResources({ resources }: { resources: VolunteerEventResource[] }) {
  if (!resources.length) return <p className={styles.empty}>Resources from your next five confirmed seva events will appear here.</p>;
  return <ul className={styles.learningResources}>{resources.map(resource => <li key={resource.event_id}>
    <div className={styles.resourceEvent}>
      <BookOpen aria-hidden="true" /><span><strong>{resource.event_title}</strong>
        <small>{formatEventTime(resource)}</small></span>
    </div>
    {resource.storage_path ? <div className={styles.resourceDownload}>
      <FileText aria-hidden="true" /><span><strong>{resource.file_name}</strong>
        {resource.file_size && <small>{resourceSize(resource.file_size)}</small>}</span>
      {resource.url && <a href={resource.url} target="_blank" rel="noreferrer"><Download aria-hidden="true" />Open</a>}
    </div> : <p className={styles.resourceWaiting}>The teacher has not attached a resource yet.</p>}
    <Link className={styles.resourceCircleLink} href={`/events/${resource.event_id}`}>Open Event Circle <ChevronRight aria-hidden="true" /></Link>
  </li>)}</ul>;
}
