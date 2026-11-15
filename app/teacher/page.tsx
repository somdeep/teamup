import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { portalSession } from "../../lib/portal-access";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { teacherDirectory, teacherEvents, teacherVolunteer, teacherVolunteerPhone } from "../../lib/teacher-data";
import { isOpenEvent, isUuid } from "../../lib/teacher-event";
import { readDirectoryFilter, volunteerDirectoryHref } from "../../lib/volunteer-directory";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import { redirect } from "next/navigation";
import { TeacherEventForm } from "./event-form";
import { EventList, InvitationList, TeacherTiles } from "./portal-sections";
import {
  VolunteerDirectory, VolunteerDirectoryDetails,
  VolunteerProfileAvailability, VolunteerProfileHero,
} from "./volunteer-directory";
import styles from "./teacher.module.css";

export const metadata: Metadata = { title: "Teacher Portal | TeamUp", robots: { index: false } };

const viewTitles = { create: "Create Event", find: "Find Volunteers", requests: "Requests", events: "My Events", priority: "Priority Request" };
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
    <AuthShell title="Teacher Portal" backHref="/account?view=settings" backLabel="Back to Account"
      headerActions={<PortalHeaderActions />}>
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
  const events = await teacherEvents(session);
  const upcoming = events.filter(event => isOpenEvent(event)).reverse();
  const requests = events.flatMap(event => event.invitations.map(invite => ({ event, invite })));
  const pendingRequests = requests.filter(item => item.invite.status === "pending").length;
  const headerActions = <PortalHeaderActions notificationsHref="/teacher?view=requests"
    pendingCount={pendingRequests} notificationLabel="Volunteer requests" />;

  if (eventId) {
    if (!isUuid(eventId)) redirect("/teacher?view=events");
    const suffix = notice ? `?notice=${encodeURIComponent(notice)}` : "";
    redirect(`/events/${eventId}${suffix}`);
  }

  if (view === "create" || view === "priority") return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal" headerActions={headerActions}
    description={view === "priority" ? "Find volunteers who are open to last-minute seva." : undefined}>
    <TeacherEventForm id={randomUUID()} priority={view === "priority"} />
  </AuthShell>;

  if (view === "find") {
    const filter = readDirectoryFilter(params);
    const inviteEvents = upcoming.filter(event => event.can_manage);
    const forEvent = inviteEvents.find(event => event.id === filter.forEvent);
    filter.forEvent = forEvent?.id ?? "";
    const personId = read("person");
    if (personId) {
      const volunteer = isUuid(personId) ? await teacherVolunteer(session, personId) : null;
      const phone = volunteer ? await teacherVolunteerPhone(session, personId) : null;
      return <AuthShell wide beforeTitle={volunteer ? <VolunteerProfileHero volunteer={volunteer} /> : undefined}
        title={volunteer?.full_name ?? "Profile unavailable"}
        description={volunteer ? <VolunteerProfileAvailability volunteer={volunteer} /> : undefined}
        backHref={volunteerDirectoryHref(filter)} backLabel="Back to Find Volunteers" headerActions={headerActions}>
        {volunteer ? <VolunteerDirectoryDetails volunteer={volunteer} event={forEvent} events={inviteEvents} phone={phone} />
          : <p className={styles.empty}>This volunteer profile is unavailable.</p>}
      </AuthShell>;
    }
    const { volunteers, hasNext } = await teacherDirectory(session, filter);
    return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal" headerActions={headerActions}>
      <VolunteerDirectory filter={filter} events={inviteEvents} event={forEvent} volunteers={volunteers} hasNext={hasNext} />
    </AuthShell>;
  }

  if (view === "circles") redirect("/teacher?view=events");

  if (view === "requests" || view === "events") return <AuthShell wide title={title} backHref="/teacher" backLabel="Back to Teacher Portal" headerActions={headerActions}>
    {view === "requests" ? <InvitationList requests={requests} /> : <EventList events={events} />}
  </AuthShell>;

  return <AuthShell wide title="Teacher Portal" backHref="/account?view=settings" backLabel="Back to Account"
    description={session.profile.full_name ? `Welcome, ${session.profile.full_name}` : "Welcome, Teacher"} headerActions={headerActions}>
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
