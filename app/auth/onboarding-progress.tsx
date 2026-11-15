import { Check } from "lucide-react";
import styles from "../about-you/about-you.module.css";

const steps = ["Create account", "Basic profile", "Seva preferences", "My Skills", "My Availability"];

export function OnboardingProgress({ step }: { step: 3 | 4 | 5 }) {
  return (
    <ol className={styles.progress} aria-label="Profile setup">
      {steps.map((label, index) => {
        const number = index + 1;
        return (
          <li key={label} aria-current={number === step ? "step" : undefined} data-upcoming={number > step || undefined}>
            {number < step ? <Check aria-hidden="true" size={18} /> : <span aria-hidden="true">{number}</span>}
            <span className="sr-only">Step {number} of {steps.length}. {label}{number < step && ", complete"}</span>
          </li>
        );
      })}
    </ol>
  );
}
