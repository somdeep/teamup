import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Binoculars } from "lucide-react";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { volunteerSession } from "../../lib/portal-access";
import { groupVolunteerInvitations, volunteerInvitations } from "../../lib/volunteer-data";
import {
  browseVolunteerOpportunities, opportunityBrowseHref, readOpportunityFilter,
} from "../../lib/volunteer-opportunities";
import { isUuid } from "../../lib/teacher-event";
import { volunteerEventResources } from "../../lib/event-resources";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import {
  CommitmentList, LearningResources, SevaHistory, VolunteerEventRows, VolunteerRequests, VolunteerTiles, type VolunteerRequestTab,
} from "./portal-sections";
import { ApplicationSubmitted, OpportunityBrowser, OpportunityDetail } from "./opportunity-browser";
import styles from "./volunteer.module.css";

export const metadata: Metadata = { title: "Volunteer Portal | TeamUp", robots: { index: false } };

const viewTitles = {
  commitments: "My Commitments",
  history: "My Seva Journey",
  resources: "Learning & Resources",
} as const;

const notices = {
  "profile-saved": "Your profile was saved.",
  "reply-saved": "Your response was saved.",
  "reply-failed": "We couldn’t save that response. The opportunity may have closed.",
  "commitment-cancelled": "Your commitment was cancelled.",
  "cancel-failed": "We couldn’t cancel that commitment. The event may have started or changed.",
  "favorite-saved": "Your saved opportunities were updated.",
  "favorite-failed": "We couldn’t update that saved opportunity.",
  "apply-failed": "We couldn’t submit that application. Check the role and try again.",
  "application-cancelled": "Your application was cancelled.",
  "application-cancel-failed": "We couldn’t cancel that application. It may already have been reviewed.",
} as const;

export default async function VolunteerPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await volunteerSession();
  const { data: onboarding, error } = await sevaAvailabilityProfile(session.client);
  if (error) throw new Error("Could not check onboarding status.");
  if (!onboarding?.complete) redirect("/about-you");
  if (!onboarding.skills_reviewed) redirect("/my-skills");
  if (!onboarding.availability_reviewed) redirect("/my-availability");

  const params = await searchParams;
  const read = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const view = read("view");
  const notice = read("notice");
  const invitations = await volunteerInvitations(session);
  const groups = groupVolunteerInvitations(invitations);
  const headerActions = <PortalHeaderActions notificationsHref="/volunteer?view=requests&tab=invitations"
    pendingCount={groups.opportunities.length} notificationLabel="Seva invitations" />;

  if (view === "opportunities") {
    const filter = readOpportunityFilter(params);
    const result = await browseVolunteerOpportunities(session, filter);
    return <AuthShell wide title={<span className={styles.browseTitle}><Binoculars aria-hidden="true" />Browse Opportunities</span>}
      description="Find seva that matches your skills, date and location."
      backHref="/volunteer" backLabel="Back to Volunteer Portal" headerActions={headerActions}>
      <div className={styles.pageStack}>
        {notice && Object.hasOwn(notices, notice) && <p className={styles.notice} role={notice.endsWith("failed") ? "alert" : "status"}>
          {notices[notice as keyof typeof notices]}
        </p>}
        <OpportunityBrowser opportunities={result.opportunities} filter={filter} unavailable={result.unavailable} />
      </div>
    </AuthShell>;
  }

  if (view === "opportunity") {
    const filter = readOpportunityFilter(params);
    const eventId = read("event");
    if (!isUuid(eventId)) redirect(opportunityBrowseHref(filter));
    const result = await browseVolunteerOpportunities(session, filter, eventId);
    const opportunity = result.opportunities[0];
    if (!opportunity) redirect(opportunityBrowseHref(filter));
    return <AuthShell wide title="Seva Opportunity" backHref={opportunityBrowseHref(filter)}
      backLabel="Back to Browse Opportunities" headerActions={headerActions}>
      <div className={styles.pageStack}>
        {notice && Object.hasOwn(notices, notice) && <p className={styles.notice} role={notice.endsWith("failed") ? "alert" : "status"}>
          {notices[notice as keyof typeof notices]}
        </p>}
        <OpportunityDetail opportunity={opportunity} filter={filter} />
      </div>
    </AuthShell>;
  }

  if (view === "applied") {
    const eventId = read("event");
    if (!isUuid(eventId)) redirect("/volunteer?view=opportunities");
    const filter = readOpportunityFilter({});
    const result = await browseVolunteerOpportunities(session, filter, eventId);
    const opportunity = result.opportunities[0];
    if (!opportunity || opportunity.request_source !== "volunteer_application") {
      redirect("/volunteer?view=requests&tab=pending");
    }
    return <AuthShell wide title="Application Submitted" backHref="/volunteer?view=opportunities"
      backLabel="Back to Browse Opportunities" headerActions={headerActions}>
      <ApplicationSubmitted opportunity={opportunity} />
    </AuthShell>;
  }

  if (view === "requests") {
    const requestedTab = read("tab");
    const tab: VolunteerRequestTab = requestedTab === "invitations" || requestedTab === "confirmed" ? requestedTab : "pending";
    return <AuthShell wide title="My Requests" description="Applications, invitations and confirmed seva in one place."
      backHref="/volunteer" backLabel="Back to Volunteer Portal" headerActions={headerActions}>
      <div className={styles.pageStack}>
        {notice && Object.hasOwn(notices, notice) && <p className={styles.notice} role={notice.endsWith("failed") ? "alert" : "status"}>
          {notices[notice as keyof typeof notices]}
        </p>}
        <VolunteerRequests invitations={invitations} tab={tab} />
      </div>
    </AuthShell>;
  }

  if (Object.hasOwn(viewTitles, view)) {
    const title = viewTitles[view as keyof typeof viewTitles];
    const resources = view === "resources" ? await volunteerEventResources(session) : [];
    return <AuthShell wide title={title} description={view === "history" ? "My past contributions and impact." : undefined}
      backHref="/volunteer" backLabel="Back to Volunteer Portal" headerActions={headerActions}>
      <div className={styles.pageStack}>
        {notice && Object.hasOwn(notices, notice) && <p className={styles.notice} role={notice.endsWith("failed") ? "alert" : "status"}>
          {notices[notice as keyof typeof notices]}
        </p>}
        {view === "commitments" && <CommitmentList invitations={groups.commitments} />}
        {view === "history" && <SevaHistory invitations={groups.history} />}
        {view === "resources" && <LearningResources resources={resources} />}
      </div>
    </AuthShell>;
  }

  const firstName = session.profile.full_name?.trim().split(/\s+/)[0] || "Volunteer";
  return <AuthShell wide title={<span className={styles.greeting}>Hi, {firstName}!<i aria-hidden="true" /></span>}
    backHref="/account?view=settings" backLabel="Back to Account" headerActions={headerActions}>
    <div className={styles.pageStack}>
      {notice && Object.hasOwn(notices, notice) && <p className={styles.notice} role="status">
        {notices[notice as keyof typeof notices]}
      </p>}
      <VolunteerTiles />
      <section className={styles.upcoming} aria-labelledby="upcoming-opportunities">
        <h2 id="upcoming-opportunities"><span>Upcoming Opportunities</span></h2>
        <VolunteerEventRows invitations={groups.upcoming.slice(0, 4)} compact />
      </section>
    </div>
  </AuthShell>;
}
