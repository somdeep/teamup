import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays, CalendarHeart, ChevronRight, ClipboardCheck, Clock3, MapPin, Send,
  UsersRound,
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
      </section>

      {event.can_manage && <nav className={styles.circleLinks} aria-label="Event management">
        <Link href={`/teacher?view=find&forEvent=${event.id}`}><Send aria-hidden="true" /><strong>Invite Volunteers</strong><ChevronRight aria-hidden="true" /></Link>
        <a href="#applications"><ClipboardCheck aria-hidden="true" /><strong>Applications</strong><ChevronRight aria-hidden="true" /></a>
      </nav>}

      {event.can_manage && <section className={styles.applications} id="applications" aria-labelledby="applications-heading">
        <h2 id="applications-heading">Applications & requests</h2>
        <InvitationList requests={invitations.map(invite => ({ event: { ...event, required_skills: [], invitations, roles: [] }, invite }))} />
      </section>}

      <MessageBoard eventId={event.id} messages={messages} />
    </div>
  </AuthShell>;
}
