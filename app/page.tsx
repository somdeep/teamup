import Image from "next/image";
import { ArrowRight } from "lucide-react";

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
        <div className="landing-actions" aria-describedby="launch-status">
          <button className="landing-button primary" disabled>
            Get Started <ArrowRight aria-hidden="true" size={25} strokeWidth={2.5} />
          </button>
          <button className="landing-button secondary" disabled>Log In</button>
          <p id="launch-status">Sign-in and volunteer onboarding are coming soon.</p>
        </div>
      </div>
      <svg className="landing-waves" aria-hidden="true" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <defs>
          <linearGradient id="teal-wave">
            <stop stopColor="#1cb9bb" stopOpacity=".8" />
            <stop offset="1" stopColor="#73d2c0" stopOpacity=".43" />
          </linearGradient>
          <linearGradient id="gold-wave">
            <stop stopColor="#ffe493" stopOpacity=".78" />
            <stop offset="1" stopColor="#ffc02a" stopOpacity=".67" />
          </linearGradient>
          <linearGradient id="orange-wave">
            <stop stopColor="#fbd14a" stopOpacity="0" />
            <stop offset="1" stopColor="#ff861d" />
          </linearGradient>
        </defs>
        <path fill="url(#teal-wave)" d="M0 97C195 67 388 172 606 191S1048 156 1440 46V220H0Z" />
        <path fill="url(#gold-wave)" d="M380 220c232-80 383-146 611-114 175 25 341-16 449-106v220Z" />
        <path fill="url(#orange-wave)" d="M570 220c428-17 526-101 649-104 89-2 164-16 221-50v154Z" />
      </svg>
    </main>
  );
}
