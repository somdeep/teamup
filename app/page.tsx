import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandWaves } from "./brand-waves";

function LotusDivider() {
  return (
    <div className="lotus-divider" aria-hidden="true">
      <span />
      <svg width="39" height="29" viewBox="0 0 48 36" fill="currentColor">
        <path d="M24 0c10 11 11 22 0 32C13 22 14 11 24 0Z" />
        <path d="M4 10c9 0 14 5 15 14C10 24 5 19 4 10Zm40 0c-9 0-14 5-15 14 9 0 14-5 15-14Z" />
        <path d="M0 24c10-3 17-1 23 9C13 38 5 32 0 24Zm48 0c-10-3-17-1-23 9 10 5 18-1 23-9Z" />
      </svg>
      <span />
    </div>
  );
}

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-content">
        <h1>
          <Image
            className="teamup-logo"
            src="/teamup-logo.webp"
            alt="TeamUp"
            width={720}
            height={720}
            sizes="(max-width: 440px) 80vw, 340px"
            unoptimized
            preload
          />
        </h1>
        <LotusDivider />
        <figure className="seva-quote">
          <blockquote>
            <p>“Service purifies the mind, expands the heart, and brings a deep sense of fulfillment.”</p>
          </blockquote>
          <figcaption>– Gurudev Sri Sri Ravi Shankar</figcaption>
        </figure>
        <LotusDivider />
        <div className="landing-actions">
          <Link className="landing-button primary" href="/sign-up">
            Get Started <ArrowRight aria-hidden="true" size={25} strokeWidth={2.5} />
          </Link>
          <Link className="landing-button secondary" href="/login">Log In</Link>
        </div>
      </div>
      <BrandWaves />
    </main>
  );
}
