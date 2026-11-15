import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import styles from "./portal-header-actions.module.css";

export function PortalHeaderActions({
  notificationsHref, pendingCount = 0, notificationLabel = "Notifications",
}: {
  notificationsHref?: string;
  pendingCount?: number;
  notificationLabel?: string;
}) {
  const count = Math.max(0, pendingCount);
  return <>
    {notificationsHref && <Link className={styles.action} href={notificationsHref}
      aria-label={count ? `${notificationLabel}, ${count} pending` : notificationLabel}>
      <Bell aria-hidden="true" size={22} strokeWidth={2.35} />
      {count > 0 && <span className={styles.badge} aria-hidden="true">{count > 9 ? "9+" : count}</span>}
    </Link>}
    <Link className={`${styles.action} ${styles.menu}`} href="/account?view=settings" aria-label="Your Account">
      <Menu aria-hidden="true" size={23} strokeWidth={3} />
    </Link>
  </>;
}
