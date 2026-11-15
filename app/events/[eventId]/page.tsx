import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays, CalendarHeart, ChevronDown, ChevronRight, ClipboardCheck, Clock3, MapPin, Plus, UsersRound,
} from "lucide-react";
import { eventCircle, eventMessages } from "../../../lib/event-circle";
import { portalNotifications } from "../../../lib/portal-notifications";
import { portalSession } from "../../../lib/portal-access";
import { isUuid } from "../../../lib/teacher-event";
import type { PortalEvent } from "../../../lib/teacher-data";
import { AuthShell } from "../../auth/auth-shell";
import { PortalHeaderActions } from "../../auth/portal-header-actions";
import { InvitationList } from "../../teacher/portal-sections";
import { MessageBoard } from "../message-board";
import styles from "../event-circle.module.css";

export const metadata: Metadata = { title: "Event Circle | TeamUp", robots: { index: false } };

function eventDate(event: { starts_at: string | null; timezone: string }) {
  if (!event.starts_at) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: event.timezone }).format(new Date(event.starts_at));
}

function eventTime(event: { starts_at: string | null; ends_at: string | null; timezone: string }) {
  if (!event.starts_at) return "Time to be confirmed";
  const format = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: event.timezone });
  return event.ends_at ? `${format.format(new Date(event.starts_at))} – ${format.format(new Date(event.ends_at))}` : format.format(new Date(event.starts_at));
}

export default async function EventCirclePage({
  params, searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();
  const session = await portalSession();
  const [event, messages, notifications] = await Promise.all([
    eventCircle(session, eventId),
    eventMessages(session, eventId),
    portalNotifications(session.client, session.user.id, session.access),
  ]);
  if (!event) notFound();

  const { notice } = await searchParams;
  let invitations: PortalEvent["invitations"] = [];
  if (event.can_manage) {
    const { data } = await session.client.rpc("teamup_teacher_events", { p_event_id: event.id });
    invitations = ((data ?? [])[0] as PortalEvent | undefined)?.invitations ?? [];
  }
  const spotsLeft = Math.max(0, event.volunteers_needed - event.confirmed_count);
  const backHref = event.can_manage ? "/teacher?view=events" : "/invitations";

  return <AuthShell wide title="Event Circle" backHref={backHref} backLabel={event.can_manage ? "Back to My Events" : "Back to Invitations"}
    headerActions={<PortalHeaderActions notificationsHref={notifications.href} pendingCount={notifications.pending} notificationLabel={notifications.label} />}>
    <div className={styles.circle}>
      {notice === "message-posted" && <p className={styles.notice} role="status">Your message was posted.</p>}
      {notice === "message-failed" && <p className={styles.notice} role="alert">We couldn’t post that message. Please try again.</p>}
      {notice === "created" && <p className={styles.notice} role="status">Event created. You can now invite volunteers.</p>}
      {notice === "invited" && <p className={styles.notice} role="status">Invitation sent in TeamUp.</p>}
      {notice === "already-invited" && <p className={styles.notice} role="status">This volunteer already has a request for this event.</p>}
      {notice === "invite-failed" && <p className={styles.notice} role="alert">We couldn’t send that request. Please try again.</p>}
      {notice === "request-cancelled" && <p className={styles.notice} role="status">The volunteer request was cancelled.</p>}
      {notice === "cancel-failed" && <p className={styles.notice} role="alert">We couldn’t cancel that request. It may already have been answered.</p>}

      {event.parent_event_id && <p className={styles.parentContext}>Part of {event.parent_can_access
        ? <Link href={`/events/${event.parent_event_id}`}>{event.parent_event_title ?? "parent event"}</Link>
        : <strong>{event.parent_event_title ?? "a parent event"}</strong>}</p>}

      <section className={styles.eventCard} aria-label="Event details">
        <div className={styles.eventArt}><CalendarHeart aria-hidden="true" /></div>
        <div>
          <h2>{event.title}</h2>
          <div className={styles.eventFacts}>
            <p><CalendarDays aria-hidden="true" /> {eventDate(event)}</p>
            <p><Clock3 aria-hidden="true" /> {eventTime(event)}</p>
            {(event.venue_name || event.city) && <p><MapPin aria-hidden="true" /> {[event.venue_name, event.city].filter(Boolean).join(" · ")}</p>}
          </div>
          {event.description && <p className={styles.description}>{event.description}</p>}
        </div>
      </section>

      <div className={styles.lotusDivider} aria-hidden="true"><span /><span>✦</span><span /></div>

      <section className={styles.volunteerCount} aria-label="Volunteer count">
        <span><UsersRound aria-hidden="true" /><strong>Volunteers</strong></span>
        <span><strong>{event.confirmed_count}</strong> Confirmed</span>
        <span className={styles.spots}>{spotsLeft} {spotsLeft === 1 ? "Spot" : "Spots"} Left</span>
        {event.can_manage && <Link className={styles.inviteVolunteers} href={`/teacher?view=find&forEvent=${event.id}`}
          aria-label={`Invite volunteers to ${event.title}`} title="Invite volunteers">
          <Plus aria-hidden="true" />
        </Link>}
      </section>

      {!event.parent_event_id && (event.can_manage || event.related_events.length > 0) && <div className={styles.relatedWrap}>
        <details className={styles.collapsible}>
          <summary>
            <span><CalendarHeart aria-hidden="true" /><strong>Related Seva</strong></span>
            <span className={styles.countBadge}>{event.related_events.length}/5</span>
            <ChevronDown className={styles.chevron} aria-hidden="true" />
          </summary>
          <div className={styles.relatedList}>
            {event.related_events.length ? event.related_events.map(related => {
              const content = <><span><strong>{related.title}</strong><small>{eventDate(related)}{related.city && ` · ${related.city}`}</small></span>
                <span className={styles.relatedCount}>{related.confirmed_count}/{related.volunteers_needed}</span>{related.can_access && <ChevronRight aria-hidden="true" />}</>;
              return related.can_access
                ? <Link key={related.id} href={`/events/${related.id}`} className={styles.relatedRow}>{content}</Link>
                : <div key={related.id} className={styles.relatedRow}>{content}</div>;
            }) : <p className={styles.emptyRelated}>No related seva has been added yet.</p>}
          </div>
        </details>
        {event.can_manage && event.related_events.length < 5 && <Link className={styles.addRelated}
          href={`/teacher?view=create&parentEvent=${event.id}`} aria-label={`Add related seva to ${event.title}`} title="Add related seva">
          <Plus aria-hidden="true" />
        </Link>}
      </div>}

      {event.can_manage && <details className={styles.collapsible} id="applications">
        <summary>
          <span><ClipboardCheck aria-hidden="true" /><strong>Applications & Requests</strong></span>
          <span className={styles.countBadge}>{invitations.length}</span>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </summary>
        <div className={styles.collapsibleContent}>
          <InvitationList requests={invitations.map(invite => ({ event: {
            ...event, required_skills: [], invitations, roles: [], parent_title: event.parent_event_title, child_count: event.related_events.length,
          }, invite }))} />
        </div>
      </details>}

      <MessageBoard eventId={event.id} messages={messages} />
    </div>
  </AuthShell>;
}
