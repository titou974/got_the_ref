"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";

/**
 * Identifiant du rapport affiché : l'abonnement souscrit depuis ce rapport doit
 * pouvoir le rattacher au compte créé. On le porte par contexte plutôt que de le
 * faire descendre à travers tous les panneaux.
 */
const AnalysisIdContext = createContext<string>("");

export const AnalysisIdProvider = AnalysisIdContext.Provider;

export function useAnalysisId(): string {
  return useContext(AnalysisIdContext);
}

/** Lien de déblocage : la page tarifs, avec le rapport à rattacher s'il est connu. */
export function unlockHref(analysisId: string): string {
  return analysisId ? `${ROUTES.pricing}?analyse=${analysisId}` : ROUTES.pricing;
}

/**
 * Rapport verrouillé ? Porté par contexte parce que la question se pose jusque
 * dans les cellules d'un tableau de diagnostic : la faire descendre en props
 * traverserait trois niveaux pour une réponse identique partout.
 */
const LockedContext = createContext<boolean>(false);

export const LockedProvider = LockedContext.Provider;

export function useLocked(): boolean {
  return useContext(LockedContext);
}

/**
 * Verrouillage d'un aperçu, version « structure lisible » : on garde nets les
 * titres, les intitulés et les noms de moteurs — le lecteur voit donc CE QUI
 * existe — et on ne floute que la donnée elle-même (positions, notes, analyses).
 *
 * Deux primitives :
 * — `Obscured` : floute et neutralise un bloc de contenu ;
 * — `UnlockBar` : la barre d'appel qui suit le bloc et renvoie vers les tarifs.
 */

export type PaywallVariant =
  | "rankings"
  | "recommendations"
  | "prompt"
  | "content"
  | "keywords"
  | "articles"
  | "presence"
  | "maps";

/** Contenu réel, flouté et retiré du focus clavier / de l'accessibilité. */
export function Obscured({
  children,
  strength = "md",
  className = "",
}: {
  children: React.ReactNode;
  /** `sm` laisse deviner la mise en forme, `md` rend le texte illisible. */
  strength?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      inert
      className={`pointer-events-none select-none saturate-[0.75] ${
        strength === "sm" ? "blur-[4px]" : "blur-[7px]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Voile une valeur seule — un score, une conclusion, une ligne de constat —
 * sans toucher au libellé qui l'accompagne. C'est la granularité visée : on cache
 * ce que l'analyse a trouvé, jamais ce qu'elle a regardé.
 */
export function Veil({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      inert
      className="pointer-events-none inline-block select-none blur-[5px] saturate-[0.75]"
    >
      {children}
    </span>
  );
}

/**
 * En-tête de section : titre et sous-titre restent nets même verrouillés — ils
 * ne dépendent pas de l'analyse, ils disent seulement ce qui a été examiné.
 */
export function SectionHeader({
  title,
  subtitle,
  locked = false,
}: {
  title: string;
  subtitle?: string;
  locked?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-lg font-bold">{title}</h3>
        {locked && <LockedPill />}
      </div>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

/** Étiquette « verrouillé » posée à côté d'un titre resté net. */
export function LockedPill() {
  const t = useTranslations("analysisReport.paywall");
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {t("lockedLabel")}
    </span>
  );
}

/**
 * Bloc verrouillé complet : en-tête net, corps flouté sous un dégradé qui le
 * fait mourir en bas de zone, puis l'appel à l'action.
 */
export function LockedBlock({
  variant,
  title,
  subtitle,
  children,
}: {
  variant: PaywallVariant;
  /** Titre affiché net au-dessus du bloc. Par défaut, celui du variant. */
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("analysisReport.paywall");

  return (
    <section>
      <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-lg font-bold">{title ?? t(`${variant}.title`)}</h3>
        <LockedPill />
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted">{subtitle ?? t(`${variant}.subtitle`)}</p>

      <div className="relative isolate">
        <Obscured>{children}</Obscured>
        {/* Le contenu s'efface vers le bas : on montre la matière, pas la donnée. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg"
        />
      </div>

      <UnlockBar variant={variant} />
    </section>
  );
}

/** Appel à l'action sous un bloc verrouillé — renvoie vers la page tarifs. */
export function UnlockBar({ variant }: { variant: PaywallVariant }) {
  const t = useTranslations("analysisReport.paywall");
  const analysisId = useAnalysisId();

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-fog bg-snow p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="text-sm text-muted">{t(`${variant}.pitch`)}</p>
      <Link
        href={unlockHref(analysisId)}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
      >
        {t("cta")}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}
