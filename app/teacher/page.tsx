import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import { portalSession } from "../../lib/portal-access";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { eventRoles, teacherDirectory, teacherEvents, teacherMatches, teacherVolunteer, teacherVolunteerPhone } from "../../lib/teacher-data";
import { formatEventTime, isOpenEvent, isUuid } from "../../lib/teacher-event";
import { readDirectoryFilter, volunteerDirectoryHref } from "../../lib/volunteer-directory";
import { AuthShell } from "../auth/auth-shell";
import { redirect } from "next/navigation";
import { TeacherEventForm } from "./event-form";
import { EventList, InvitationList, TeacherTiles, VolunteerCard } from "./portal-sections";
import {
  DirectoryHeader, VolunteerDirectory, VolunteerDirectoryDetails,
  VolunteerProfileAvailability, VolunteerProfileHero,
} from "./volunteer-directory";
import styles from "./teacher.module.css";

export const metadata: Metadata = { title: "Teacher Portal | TeamUp", robots: { index: false } };

const viewTitles = { create: "Create Event", find: "Find Volunteers", requests: "Requests", events: "My Events", circles: "Event Circles", priority: "Priority Request" };
const messages = {
  created: "Event created. Find and invite volunteers below.",
  invited: "Invitation sent in TeamUp.",
  "already-invited": "This volunteer already has an invitation for this event.",
  "invite-failed": "We couldn’t send the invitation. Check that the event is still open.",
  "request-cancelled": "The volunteer request was cancelled.",
  "cancel-failed": "We couldn’t cancel that request. It may have already been answered.",
  "profile-saved": "Your profile was saved.",
};

export default async function TeacherPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await portalSession();
  if (session.access.role !== "teacher" && session.access.teacher_request !== "pending") {
    redirect("/account?notice=teacher-access");
  }
  const { data: onboarding, error: onboardingError } = await sevaAvailabilityProfile(session.client);
  if (onboardingError) throw new Error("Could not check onboarding status.");
  if (!onboarding?.complete) redirect("/about-you");
  if (!onboarding.skills_reviewed) redirect("/my-skills");
  if (!onboarding.availability_reviewed) redirect("/my-availability");

  if (session.access.role !== "teacher") return (
    <AuthShell title="Teacher Portal" backHref="/account?view=settings" backLabel="Back to Account">
      <div className={styles.stack}>
        <p className={styles.notice} role="status">Your Teacher access request is pending.</p>
        <Link className="landing-button secondary" href="/account?view=settings">Your Account</Link>
      </div>
    </AuthShell>
  );
  const params = await searchParams;
  const read = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const view = read("view");
  const eventId = read("event");
  const notice = read("notice");
  const message = Object.hasOwn(messages, notice) ? messages[notice as keyof typeof messages] : undefined;
  const title = Object.hasOwn(viewTitles, view) ? viewTitles[view as keyof typeof viewTitles] : "Teacher Portal";

  if (eventId) {
    const [event] = isUuid(eventId) ? await teacherEvents(session, eventId) : [];
    if (!event) return <AuthShell wide title="Event unavailable" backHref="/teacher" backLabel="Back to Teacher Portal">
      <p className={styles.empty}>This event or its circle is unavailable from your account.</p>
    </AuthShell>;
    const open = event.can_manage && isOpenEvent(event);
    const matches = open ? await teacherMatches(session, event.id) : [];
    const confirmed = event.invitations.filter(invite => invite.status === "accepted").length;
    return <AuthShell wide title={event.can_manage ? "Event Circle" : "Event Details"} backHref="/teacher" backLabel="Back to Teacher Portal">
      <div className={styles.stack}>
        {message && <p className={styles.notice} role={notice === "invite-failed" || notice === "cancel-failed" ? "alert" : "status"}>{message}</p>}
        <section className={styles.eventInfo} aria-label="Event details">
          <h2>{event.title}</h2>
          <p><CalendarDays aria-hidden="true" size={18} /> {formatEventTime(event)}</p>
          {event.city && <p><MapPin aria-hidden="true" size={18} /> {[event.venue_name, event.city].filter(Boolean).join(" · ")}</p>}
          {event.roles.length > 0 && <p><UsersRound aria-hidden="true" size={18} /> {eventRoles(event)}</p>}
          {event.can_manage && <p>{confirmed} confirmed · {Math.max(0, event.volunteers_needed - confirmed)} spots left</p>}
          {event.description && <p>{event.description}</p>}
        </section>
        {open && <section className={styles.stack} aria-labelledby="matches-heading">
          <div className={styles.sectionHeader}>
            <h2 id="matches-heading">Suggested Volunteers</h2>
            <Link className={styles.textLink} href={`/teacher?view=find&forEvent=${event.id}`}>Search directory</Link>
          </div>
          {matches.length ? <ul className={styles.stack}>{matches.map(match => (
            <VolunteerCard key={match.person_id} volunteer={match} match={match} event={event} />
          ))}</ul> : <p className={styles.empty}>No volunteers have scheduled availability for the full event.</p>}
        </section>}
        {event.can_manage && <section className={styles.stack} aria-labelledby="invite-heading">
          <h2 id="invite-heading">Invitations</h2>
          <InvitationList requests={event.invitations.map(invite => ({ event, invite }))} />
        </section>}
      </div>
    </AuthShell>;
  }

  if (view === "create" || view === "priority") return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal"
    description={view === "priority" ? "Find volunteers who are open to last-minute seva." : undefined}>
    <TeacherEventForm id={randomUUID()} priority={view === "priority"} />
  </AuthShell>;

  const events = await teacherEvents(session);
  const upcoming = events.filter(event => isOpenEvent(event)).reverse();
  const requests = events.flatMap(event => event.invitations.map(invite => ({ event, invite })));

  if (view === "find") {
    const filter = readDirectoryFilter(params);
    const inviteEvents = upcoming.filter(event => event.can_manage);
    const forEvent = inviteEvents.find(event => event.id === filter.forEvent);
    filter.forEvent = forEvent?.id ?? "";
    const headerActions = <DirectoryHeader hasRequests={requests.some(item => item.invite.status === "pending")} />;
    const personId = read("person");
    if (personId) {
      const volunteer = isUuid(personId) ? await teacherVolunteer(session, personId) : null;
      const phone = volunteer ? await teacherVolunteerPhone(session, personId) : null;
      return <AuthShell wide beforeTitle={volunteer ? <VolunteerProfileHero volunteer={volunteer} /> : undefined}
        title={volunteer?.full_name ?? "Profile unavailable"}
        description={volunteer ? <VolunteerProfileAvailability volunteer={volunteer} /> : undefined}
        backHref={volunteerDirectoryHref(filter)} backLabel="Back to Find Volunteers" headerActions={headerActions}>
        {volunteer ? <VolunteerDirectoryDetails volunteer={volunteer} event={forEvent} phone={phone} />
          : <p className={styles.empty}>This volunteer profile is unavailable.</p>}
      </AuthShell>;
    }
    const { volunteers, hasNext } = await teacherDirectory(session, filter);
    return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal" headerActions={headerActions}>
      <VolunteerDirectory filter={filter} events={inviteEvents} event={forEvent} volunteers={volunteers} hasNext={hasNext} />
    </AuthShell>;
  }

  if (view === "requests" || view === "events" || view === "circles") return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal">
    {view === "requests" ? <InvitationList requests={requests} /> : <EventList events={view === "circles" ? events.filter(event => event.can_manage) : events} circle={view === "circles"} />}
  </AuthShell>;

  return <AuthShell wide title="Teacher Portal" backHref="/account?view=settings" backLabel="Back to Account"
    description={session.profile.full_name ? `Welcome, ${session.profile.full_name}` : "Welcome, Teacher"}>
    <div className={styles.stack}>
      {message && <p className={styles.notice} role="status">{message}</p>}
      <TeacherTiles pending={requests.filter(item => item.invite.status === "pending").length} />
      <section className={styles.stack} aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Upcoming Events</h2>
        <EventList events={upcoming.slice(0, 4)} />
      </section>
    </div>
  </AuthShell>;
}
