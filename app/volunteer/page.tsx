import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { volunteerSession } from "../../lib/portal-access";
import { groupVolunteerInvitations, volunteerInvitations } from "../../lib/volunteer-data";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import {
  CommitmentList, OpportunityList, SevaHistory, VolunteerEventRows, VolunteerTiles,
} from "./portal-sections";
import styles from "./volunteer.module.css";

export const metadata: Metadata = { title: "Volunteer Portal | TeamUp", robots: { index: false } };

const viewTitles = {
  opportunities: "Find Seva Opportunities",
  commitments: "My Commitments",
  history: "My Seva History",
  resources: "Learning & Resources",
} as const;

const notices = {
  "profile-saved": "Your profile was saved.",
  "reply-saved": "Your response was saved.",
  "reply-failed": "We couldn’t save that response. The opportunity may have closed.",
  "commitment-cancelled": "Your commitment was cancelled.",
  "cancel-failed": "We couldn’t cancel that commitment. The event may have started or changed.",
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
  const headerActions = <PortalHeaderActions notificationsHref="/volunteer?view=opportunities"
    pendingCount={groups.opportunities.length} notificationLabel="Seva opportunities" />;

  if (Object.hasOwn(viewTitles, view)) {
    const title = viewTitles[view as keyof typeof viewTitles];
    return <AuthShell wide title={title} backHref="/volunteer" backLabel="Back to Volunteer Portal" headerActions={headerActions}>
      <div className={styles.pageStack}>
        {notice && Object.hasOwn(notices, notice) && <p className={styles.notice} role={notice.endsWith("failed") ? "alert" : "status"}>
          {notices[notice as keyof typeof notices]}
        </p>}
        {view === "opportunities" && <OpportunityList invitations={groups.opportunities} />}
        {view === "commitments" && <CommitmentList invitations={groups.commitments} />}
        {view === "history" && <SevaHistory invitations={groups.history} />}
        {view === "resources" && <section className={styles.resources}>
          <h2>More ways to grow in seva</h2>
          <p>Curated learning resources will be available here in a future update.</p>
          <p>For now, keep your skills and interests current so teachers can match you with the right opportunities.</p>
        </section>}
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
