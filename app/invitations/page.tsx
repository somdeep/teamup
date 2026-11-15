import type { Metadata } from "next";
import Link from "next/link";
import { portalSession } from "../../lib/portal-access";
import type { InvitationStatus, PortalEvent } from "../../lib/teacher-data";
import { formatEventTime, isOpenEvent } from "../../lib/teacher-event";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import styles from "../teacher/teacher.module.css";
import { replyToInvitation } from "./actions";

export const metadata: Metadata = { title: "Invitations | TeamUp", robots: { index: false } };

type InboxInvitation = { id: string; status: InvitationStatus; events: Pick<PortalEvent, "id" | "title" | "city" | "starts_at" | "timezone" | "status"> | null };

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { client, profile } = await portalSession();
  const { notice } = await searchParams;
  const { data, error } = profile.person_id ? await client.from("invitations").select("id,status,events(id,title,city,starts_at,timezone,status)")
    .eq("person_id", profile.person_id).order("invited_at", { ascending: false }).limit(1000) : { data: [], error: null };
  const invitations = (data ?? []) as unknown as InboxInvitation[];

  const pending = invitations.filter(item => item.status === "pending").length;
  return <AuthShell wide title="Invitations" backHref="/account?view=settings" backLabel="Back to Account"
    headerActions={<PortalHeaderActions notificationsHref="/invitations" pendingCount={pending} notificationLabel="Invitations" />}>
    <div className={styles.stack}>
      {notice === "saved" && <p role="status" className={styles.notice}>Your reply was saved.</p>}
      {notice === "reply-failed" && <p role="alert" className={styles.notice}>We couldn’t save your reply. The invitation may be closed or already answered.</p>}
      {error && <p role="alert" className={styles.notice}>We couldn’t load your invitations. Refresh to try again.</p>}
      {!error && invitations.length === 0 && <p className={styles.empty}>Your seva invitations will appear here.</p>}
      {invitations.length > 0 && <ul className={styles.stack}>{invitations.map(item => (
        <li key={item.id} className={styles.eventInfo}>
          <div className={styles.sectionHeader}>
            <h2>{item.events?.title ?? "Seva event"}</h2>
            <span className={styles.status} data-status={item.status}>{item.status}</span>
          </div>
          {item.events && <p>{formatEventTime(item.events)}{item.events.city && ` · ${item.events.city}`}</p>}
          {item.status === "pending" && item.events && isOpenEvent(item.events) && (
            <form action={replyToInvitation} className={styles.responseForm}>
              <input type="hidden" name="invitationId" value={item.id} />
              <button className={styles.smallButton} name="response" value="accepted">Accept</button>
              <button className={styles.smallButton} name="response" value="declined">Decline</button>
            </form>
          )}
          {item.status === "accepted" && item.events && <Link className={styles.textLink} href={`/events/${item.events.id}`}>Open event circle</Link>}
        </li>
      ))}</ul>}
    </div>
  </AuthShell>;
}
