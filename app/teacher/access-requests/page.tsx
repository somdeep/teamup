import type { Metadata } from "next";
import { Check, MapPin, UserCheck, X } from "lucide-react";
import { teacherSession } from "../../../lib/portal-access";
import { pendingTeacherAccessRequests } from "../../../lib/teacher-access-requests";
import { AuthShell } from "../../auth/auth-shell";
import { PortalHeaderActions } from "../../auth/portal-header-actions";
import { reviewTeacherAccess } from "./actions";
import styles from "./teacher-access-requests.module.css";

export const metadata: Metadata = { title: "Teacher Access Requests | TeamUp", robots: { index: false } };

export default async function TeacherAccessRequestsPage({
  searchParams,
}: { searchParams: Promise<{ notice?: string }> }) {
  const session = await teacherSession();
  const { data: requests, error } = await pendingTeacherAccessRequests(session);
  if (error) throw new Error("Could not load teacher access requests.");
  const { notice } = await searchParams;

  return <AuthShell title="Teacher Access Requests" description="Verify who should receive Teacher Portal access."
    backHref="/account?view=settings" backLabel="Back to Your Account" headerActions={<PortalHeaderActions />}>
    <section className={styles.panel} aria-label="Pending teacher access requests">
      {notice === "approved" && <p className={styles.notice} role="status">Teacher access was approved.</p>}
      {notice === "declined" && <p className={styles.notice} role="status">The request was declined.</p>}
      {notice === "review-failed" && <p className={styles.error} role="alert">That request could not be reviewed. It may already have changed.</p>}
      {requests.length ? <ul className={styles.list}>{requests.map(request => <li key={request.account_id} className={styles.card}>
        <div className={styles.identity}>
          <span className={styles.avatar}><UserCheck aria-hidden="true" /></span>
          <span><strong>{request.full_name}</strong><small>{request.email}</small></span>
        </div>
        {request.location && <p className={styles.location}><MapPin aria-hidden="true" />{request.location}</p>}
        <p className={styles.requested}>Requested {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.requested_at))}</p>
        <form action={reviewTeacherAccess} className={styles.actions}>
          <input type="hidden" name="accountId" value={request.account_id} />
          <button name="decision" value="approve" className={styles.approve}><Check aria-hidden="true" />Approve</button>
          <button name="decision" value="decline" className={styles.decline}><X aria-hidden="true" />Decline</button>
        </form>
      </li>)}</ul> : <p className={styles.empty}>There are no pending Teacher access requests.</p>}
    </section>
  </AuthShell>;
}
