import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Card citation présentée en haut de la page d'accueil.
 * Définit le GEO (Generative Engine Optimization) et le rôle de GEOBoost.
 * Style glassmorphism aligné sur le thème (accent émeraude, .card-cal).
 */
export async function GeoQuoteCard() {
  const t = await getTranslations("geoQuote");

  return (
    <figure className="card-cal relative mx-auto w-full max-w-6xl overflow-hidden px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-start gap-4">
        {/* Guillemet décoratif (SVG, pas d'emoji) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="mt-0.5 h-7 w-7 flex-shrink-0 text-accent opacity-80"
          fill="currentColor"
        >
          <path d="M9.5 6C6.46 6 4 8.46 4 11.5V18h6.5v-6.5H7.5C7.5 9.57 8.4 8.5 9.5 8.5V6zm10 0c-3.04 0-5.5 2.46-5.5 5.5V18H20.5v-6.5h-3C17.5 9.57 18.4 8.5 19.5 8.5V6z" />
        </svg>

        <blockquote className="text-pretty text-sm leading-relaxed text-text sm:text-base">
          <p>
            {t.rich("text", {
              geo: (chunks: ReactNode) => (
                <span className="font-semibold text-accent">{chunks}</span>
              ),
              muted: (chunks: ReactNode) => (
                <span className="text-muted">{chunks}</span>
              ),
              highlight: (chunks: ReactNode) => (
                <span className="text-gradient font-semibold">{chunks}</span>
              ),
              brand: (chunks: ReactNode) => (
                <span className="font-semibold">{chunks}</span>
              ),
            })}
          </p>
        </blockquote>
      </div>
    </figure>
  );
}
