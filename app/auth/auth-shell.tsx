import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandWaves } from "../brand-waves";
import styles from "../sign-up/sign-up.module.css";

export function AuthShell({
  title, description, beforeTitle, backHref = "/", backLabel = "Back to TeamUp home", wide = false, children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  beforeTitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className={`landing ${styles.page}`}>
      <div className={wide ? `${styles.content} ${styles.wideContent}` : styles.content}>
        <header className={styles.header}>
          <Link className={styles.back} href={backHref} aria-label={backLabel}>
            <ArrowLeft aria-hidden="true" size={21} />
          </Link>
          <Link className={styles.brand} href="/" aria-label="TeamUp home">
            <span className={styles.brandMark}>
              <Image src="/teamup-logo.webp" alt="" width={720} height={720} unoptimized />
            </span>
            <span className={styles.wordmark}>
              <Image src="/teamup-logo.webp" alt="" width={720} height={720} unoptimized />
            </span>
          </Link>
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
