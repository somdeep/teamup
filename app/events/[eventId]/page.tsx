import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays, CalendarHeart, ChevronDown, ChevronRight, ClipboardCheck, Clock3, MapPin, Plus, UserRound, UsersRound,
} from "lucide-react";
import { eventCircle, eventMessages } from "../../../lib/event-circle";
import { eventResource } from "../../../lib/event-resources";
import { portalNotifications } from "../../../lib/portal-notifications";
import { portalSession } from "../../../lib/portal-access";
import { isUuid } from "../../../lib/teacher-event";
import type { PortalEvent } from "../../../lib/teacher-data";
import { AuthShell } from "../../auth/auth-shell";
import { PortalHeaderActions } from "../../auth/portal-header-actions";
import { InvitationList } from "../../teacher/portal-sections";
import { MessageBoard } from "../message-board";
import { EventResourcePanel } from "../event-resource";
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
  const [event, messages, notifications, resource] = await Promise.all([
    eventCircle(session, eventId),
    eventMessages(session, eventId),
    portalNotifications(session.client, session.user.id, session.access),
    eventResource(session, eventId),
  ]);
  if (!event) notFound();

  const { notice } = await searchParams;
  let invitations: PortalEvent["invitations"] = [];
  if (event.can_manage) {
    const { data } = await session.client.rpc("teamup_teacher_events", { p_event_id: event.id });
    invitations = ((data ?? [])[0] as PortalEvent | undefined)?.invitations ?? [];
  }
  const invitationEvent: PortalEvent = {
    ...event,
    required_skills: [],
    invitations,
    roles: [],
    parent_title: event.parent_event_title,
    child_count: event.related_events.length,
  };
  const confirmedInvitations = invitations.filter(invitation => invitation.status === "accepted");
  const spotsLeft = Math.max(0, event.volunteers_needed - event.confirmed_count);
  const backHref = event.can_manage ? "/teacher?view=events" : "/volunteer?view=requests&tab=confirmed";

  return <AuthShell wide title="Event Circle" backHref={backHref} backLabel={event.can_manage ? "Back to My Events" : "Back to My Requests"}
    headerActions={<PortalHeaderActions notificationsHref={notifications.href} pendingCount={notifications.pending} notificationLabel={notifications.label} />}>
    <div className={styles.circle}>
      {notice === "message-posted" && <p className={styles.notice} role="status">Your message was posted.</p>}
      {notice === "message-failed" && <p className={styles.notice} role="alert">We couldn’t post that message. Please try again.</p>}
      {notice === "image-invalid" && <p className={styles.notice} role="alert">Choose a JPG, PNG, WebP or GIF image no larger than 5 MB.</p>}
      {notice === "image-failed" && <p className={styles.notice} role="alert">We couldn’t upload that image. Please try again.</p>}
      {notice === "resource-saved" && <p className={styles.notice} role="status">The event resource was saved.</p>}
      {notice === "resource-removed" && <p className={styles.notice} role="status">The event resource was removed.</p>}
      {notice === "resource-invalid" && <p className={styles.notice} role="alert">Choose a PDF, image, text or Word document no larger than 10 MB.</p>}
      {(notice === "resource-failed" || notice === "resource-remove-failed") && <p className={styles.notice} role="alert">We couldn’t update the event resource. Please try again.</p>}
      {notice === "created" && <p className={styles.notice} role="status">Event created. You can now invite volunteers.</p>}
      {notice === "invited" && <p className={styles.notice} role="status">Invitation sent in TeamUp.</p>}
      {notice === "already-invited" && <p className={styles.notice} role="status">This volunteer already has a request for this event.</p>}
      {notice === "invite-failed" && <p className={styles.notice} role="alert">We couldn’t send that request. Please try again.</p>}
      {notice === "request-cancelled" && <p className={styles.notice} role="status">The volunteer request was cancelled.</p>}
      {notice === "cancel-failed" && <p className={styles.notice} role="alert">We couldn’t cancel that request. It may already have been answered.</p>}
      {notice === "application-accepted" && <p className={styles.notice} role="status">The volunteer application was accepted.</p>}
      {notice === "application-declined" && <p className={styles.notice} role="status">The volunteer application was declined.</p>}
      {notice === "review-failed" && <p className={styles.notice} role="alert">We couldn’t review that application. The event may be full or the request may have changed.</p>}

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
            {!event.can_manage && event.organizer_names.length > 0 && <p><UserRound aria-hidden="true" /> Organized by {event.organizer_names.join(" · ")}</p>}
          </div>
          {event.description && <p className={styles.description}>{event.description}</p>}
        </div>
      </section>

      <EventResourcePanel eventId={event.id} resource={resource} canManage={event.can_manage} />

      <div className={styles.lotusDivider} aria-hidden="true"><span /><span>✦</span><span /></div>

      <div className={styles.volunteerWrap}>
        <details className={styles.collapsible} id="volunteers">
          <summary className={styles.volunteerSummary}>
            <span><UsersRound aria-hidden="true" /><strong>Volunteers</strong></span>
            <span className={styles.confirmed}><strong>{event.confirmed_count}</strong> Confirmed</span>
            <span className={styles.spots}>{spotsLeft} {spotsLeft === 1 ? "Spot" : "Spots"} Left</span>
            <ChevronDown className={styles.chevron} aria-hidden="true" />
          </summary>
          <div className={styles.collapsibleContent}>
            {event.can_manage
              ? confirmedInvitations.length
                ? <InvitationList requests={confirmedInvitations.map(invite => ({ event: invitationEvent, invite }))} />
                : <p className={styles.emptyRelated}>No volunteers are confirmed yet.</p>
              : <p className={styles.emptyRelated}>{event.confirmed_count
                ? `${event.confirmed_count} ${event.confirmed_count === 1 ? "volunteer is" : "volunteers are"} confirmed for this event.`
                : "No volunteers are confirmed yet."}</p>}
          </div>
        </details>
        {event.can_manage && <Link className={styles.inviteVolunteers} href={`/teacher?view=find&forEvent=${event.id}`}
          aria-label={`Invite volunteers to ${event.title}`} title="Invite volunteers">
          <Plus aria-hidden="true" />
        </Link>}
      </div>

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
              const volunteerCanApply = session.access.role === "volunteer" && related.status === "scheduled"
                && related.confirmed_count < related.volunteers_needed;
              return related.can_access
                ? <Link key={related.id} href={`/events/${related.id}`} className={styles.relatedRow}>{content}</Link>
                : volunteerCanApply
                  ? <Link key={related.id} href={`/volunteer?view=opportunity&event=${related.id}`} className={styles.relatedRow}>{content}</Link>
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
          <InvitationList requests={invitations.map(invite => ({ event: invitationEvent, invite }))} />
        </div>
      </details>}

      <MessageBoard eventId={event.id} messages={messages} />
    </div>
  </AuthShell>;
}
