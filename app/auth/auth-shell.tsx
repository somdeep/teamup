import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandWaves } from "../brand-waves";
import styles from "../sign-up/sign-up.module.css";

export function AuthShell({
  title, description, beforeTitle, backHref = "/", backLabel = "Back to TeamUp home", children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  beforeTitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={`landing ${styles.page}`}>
      <div className={styles.content}>
        <header className={styles.header}>
          <Link className={styles.back} href={backHref} aria-label={backLabel}>
            <ArrowLeft aria-hidden="true" size={21} />
          </Link>
          <div className={styles.brand} aria-label="TeamUp" role="img">
            <span className={styles.brandMark}>
              <Image src="/teamup-logo.webp" alt="" width={720} height={720} unoptimized />
            </span>
            <span className={styles.wordmark}>
              <Image src="/teamup-logo.webp" alt="" width={720} height={720} unoptimized />
            </span>
          </div>
          {beforeTitle}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </header>
        {children}
      </div>
      <BrandWaves />
    </main>
  );
}
