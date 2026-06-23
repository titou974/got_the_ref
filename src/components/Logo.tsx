import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight cursor-pointer ${className}`}
    >
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="9" fill="url(#bg-logo)" />
        <path
          d="M9 21V11h4.6c2.2 0 3.6 1.1 3.6 2.9 0 1.2-.7 2.1-1.8 2.4 1.4.3 2.2 1.3 2.2 2.6 0 2-1.5 3.1-3.9 3.1H9Z"
          fill="white"
        />
        <circle cx="22.5" cy="12" r="2.5" fill="#11b48c" />
        <defs>
          <linearGradient
            id="bg-logo"
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#0d9b78" />
            <stop offset="1" stopColor="#11b48c" />
          </linearGradient>
        </defs>
      </svg>
      <span>
        <span className="text-accent">GEO</span>Boost
      </span>
    </Link>
  );
}
