import { SITE } from "@/constants/site";

type Variant = "primary" | "secondary";

/**
 * Bouton de prise de rendez-vous pointant vers le lien Cal (SITE.calUrl).
 * Simple ancre externe — aucune logique client requise.
 */
export function BookCallButton({
  label,
  variant = "primary",
  className = "",
}: {
  label: string;
  variant?: Variant;
  className?: string;
}) {
  const base =
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40";
  const styles =
    variant === "primary"
      ? "bg-cta text-white shadow-[var(--shadow-pill)] hover:bg-cta-hover"
      : "border border-graphite bg-snow text-graphite hover:bg-mist";

  return (
    <a
      href={SITE.calUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles} ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {label}
    </a>
  );
}
