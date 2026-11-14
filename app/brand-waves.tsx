export function BrandWaves() {
  return (
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
  );
}
