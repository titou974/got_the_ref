"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";
import aiAssistant from "@/lottie/ai-assistant.json";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Bandeau de fin de rapport. Remplace l'ancien appel « Découvrez nos services /
 * Prendre rendez-vous » : au bas d'une analyse, ce que le lecteur veut n'est pas
 * un rendez-vous mais l'accès à ce qui reste flouté — le bandeau mène donc aux
 * tarifs, en emportant l'identifiant du rapport pour qu'il s'ouvre après la
 * souscription.
 */
export function UnlockPricingCta({
  analysisId,
  locked,
}: {
  analysisId: string;
  /** Rapport déjà ouvert : promettre un déblocage n'aurait plus de sens. */
  locked: boolean;
}) {
  const t = useTranslations("ctaUnlock");
  const href = analysisId ? `${ROUTES.pricing}?analyse=${analysisId}` : ROUTES.pricing;
  const key = (base: string) => (locked ? base : `open${base[0].toUpperCase()}${base.slice(1)}`);

  return (
    <section className="card-cal relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
      <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:gap-10 lg:text-left">
        {/* Assistant IA animé : l'agent qui exécute les prompts du rapport. */}
        <div className="w-40 shrink-0 sm:w-48 lg:w-56" aria-hidden>
          <Lottie animationData={aiAssistant} loop autoplay className="h-full w-full" />
        </div>

        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
          <h2 className="mt-2 text-balance text-2xl font-bold sm:text-3xl">{t(key("title"))}</h2>
          <p className="mt-3 max-w-xl text-pretty text-muted">{t(key("subtitle"))}</p>

          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted lg:justify-start">
            {(["bullet1", "bullet2", "bullet3"] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-accent" aria-hidden>
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t(k)}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href={href}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {t(key("button"))}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href={ROUTES.pricing}
              className="inline-flex cursor-pointer items-center justify-center rounded-full border border-graphite bg-snow px-6 py-3 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {t("secondary")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
