import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import { portalSession } from "../../lib/portal-access";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { sevaSkills } from "../../lib/signup-profile";
import { eventRoles, teacherDirectory, teacherEvents, teacherMatches } from "../../lib/teacher-data";
import { formatEventTime, isOpenEvent, isUuid } from "../../lib/teacher-event";
import { AuthShell } from "../auth/auth-shell";
import { redirect } from "next/navigation";
import { TeacherEventForm } from "./event-form";
import { EventList, InvitationList, TeacherTiles, VolunteerCard } from "./portal-sections";
import styles from "./teacher.module.css";

export const metadata: Metadata = { title: "Teacher Portal | TeamUp", robots: { index: false } };

const viewTitles = { create: "Create Event", find: "Find Volunteers", requests: "Requests", events: "My Events", circles: "Event Circles", priority: "Priority Request" };
const messages = {
  created: "Event created. Find and invite volunteers below.",
  invited: "Invitation sent in TeamUp.",
  "already-invited": "This volunteer already has an invitation for this event.",
  "invite-failed": "We couldn’t send the invitation. Check that the event is still open.",
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
        {message && <p className={styles.notice} role={notice === "invite-failed" ? "alert" : "status"}>{message}</p>}
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
    const page = Math.min(1000, Math.max(1, Number.parseInt(read("page"), 10) || 1));
    const filter = { name: read("name").slice(0, 80), city: read("city").slice(0, 80), skill: read("skill"), page };
    const inviteEvents = upcoming.filter(event => event.can_manage);
    const forEvent = inviteEvents.find(event => event.id === read("forEvent"));
    const { volunteers, hasNext } = await teacherDirectory(session, filter);
    const pageLink = (number: number) => `/teacher?${new URLSearchParams({ view, name: filter.name, city: filter.city, skill: filter.skill, page: String(number), forEvent: forEvent?.id ?? "" })}`;
    return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal">
      <div className={styles.stack}>
        <form className={styles.stack} action="/teacher">
          <input type="hidden" name="view" value="find" />
          <div className={styles.two}>
            <label className={styles.field}>Name<input name="name" maxLength={80} defaultValue={filter.name} placeholder="Search by name" /></label>
            <label className={styles.field}>City<input name="city" maxLength={80} defaultValue={filter.city} placeholder="Search by city" /></label>
            <label className={styles.field}>Skill<select name="skill" defaultValue={filter.skill}><option value="">All skills</option>
              {sevaSkills.map(skill => <option key={skill}>{skill}</option>)}</select></label>
            <label className={styles.field}>Invite to an event<select name="forEvent" defaultValue={forEvent?.id ?? ""}><option value="">Choose an event</option>
              {inviteEvents.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          </div>
          <button className="landing-button primary">Search Volunteers</button>
        </form>
        {volunteers.length ? <ul className={styles.stack}>{volunteers.map(volunteer => (
          <VolunteerCard key={volunteer.person_id} volunteer={volunteer} event={forEvent} />
        ))}</ul> : <p className={styles.empty}>No volunteers match these filters.</p>}
        {(page > 1 || hasNext) && <nav className={styles.sectionHeader} aria-label="Volunteer results pages">
          {page > 1 && <Link className={styles.textLink} href={pageLink(page - 1)}>Previous</Link>}
          {hasNext && <Link className={styles.textLink} href={pageLink(page + 1)}>Next</Link>}
        </nav>}
      </div>
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
