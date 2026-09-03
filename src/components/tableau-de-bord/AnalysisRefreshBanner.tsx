"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { RiCloseLine, RiRadarLine } from "@remixicon/react";
import { refreshAnalysisAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/constants/routes";
import { tierAtLeast, type AccessTier } from "@/constants/access";

/**
 * Le bandeau de reprise, posé tout en haut du tableau de bord.
 *
 * L'analyse d'un compte datait du jour de l'achat : le client corrigeait son
 * H1, publiait ses articles, et sa note ne bougeait pas d'un point. Le bandeau
 * est l'endroit où il reprend la mesure — une fois par jour, avant tout le
 * reste, puisque c'est le geste qui rend le reste de l'écran vrai.
 *
 * Il dit aussi ce que la reprise NE touche pas. Un client qui a fait rédiger
 * douze articles et travaillé ses backlinks n'appuie pas sur un bouton qui
 * annonce « tout recalculer » sans savoir ce qu'il risque : la phrase est donc
 * dans le corps du bandeau, pas dans une note de bas de page.
 *
 * Trois états, un seul bloc :
 *   — disponible : le bouton part, et la barre d'attente prend sa place le
 *     temps du crawl et de l'audit (deux à trois minutes, c'est écrit).
 *   — déjà repris aujourd'hui : le bouton est fermé et la date de la prochaine
 *     reprise remplace l'accroche. Le bandeau reste, il fait office de reçu.
 *   — hors abonnement : la reprise appartient à l'abonnement Tout-en-un, une
 *     mesure par jour pour une offre qui court dans la durée. Le bouton devient
 *     le lien vers les offres.
 *
 * Refermé, il ne revient que le lendemain : c'est un rappel quotidien, pas un
 * message qu'on range une fois pour toutes.
 */

const DISMISS_KEY = "gotref:banner:refresh";

/** La journée en cours, en clé de stockage : « 2026-09-02 ». */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Sans mémoire, le bandeau reviendra au prochain chargement. Tant pis. */
  }
}

export function AnalysisRefreshBanner({
  tier,
  availableToday,
  lastRefreshedAt,
  /** Ancre de la carte de progression, quand il y a déjà deux mesures. */
  progressHref,
}: {
  tier: AccessTier;
  availableToday: boolean;
  /** ISO, ou `null` quand l'analyse n'a jamais été reprise. */
  lastRefreshedAt: string | null;
  progressHref?: string;
}) {
  const t = useTranslations("dashboard.refresh");
  const router = useRouter();

  // Le premier rendu montre le bandeau : ce que le navigateur a retenu ne se
  // lit qu'après hydratation, et masquer par défaut ferait clignoter la page
  // pour les trois quarts des clients qui ne l'ont jamais fermé. La relecture
  // est donc reportée d'un tour de boucle — le balisage servi et le premier
  // rendu client restent identiques.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (read(DISMISS_KEY) === today()) setDismissed(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // L'attente couvre deux temps : l'audit, puis le rafraîchissement de la page
  // qui rapporte la nouvelle note. Les enchaîner sous un seul indicateur évite
  // que l'ancienne note reparaisse une seconde entre les deux.
  const [isRefreshing, startRefresh] = useTransition();
  const { execute, isPending, result } = useAction(refreshAnalysisAction, {
    onSuccess: () => startRefresh(() => router.refresh()),
  });
  const working = isPending || isRefreshing;

  if (dismissed && !working) return null;

  // La reprise revient chaque jour : elle suit l'offre qui revient chaque mois.
  // Le Coup de Boost, passe unique, n'y donne pas droit.
  const paid = tierAtLeast(tier, "allin");
  const open = paid && availableToday;

  const lastLabel = lastRefreshedAt
    ? t("last", {
        date: new Date(lastRefreshedAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
        }),
      })
    : t("never");

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border bg-surface-2 p-5 sm:p-6">
      {/* Le bandeau se referme pour la journée. Pas pendant l'audit : refermer
          ce qui travaille ferait croire à un abandon. */}
      {!working && (
        <div className="absolute right-0 top-0 pr-3 pt-3">
          <button
            type="button"
            onClick={() => {
              write(DISMISS_KEY, today());
              setDismissed(true);
            }}
            aria-label={t("close")}
            className="cursor-pointer rounded-xl p-2 text-ash transition-colors duration-200 hover:text-text"
          >
            <RiCloseLine className="size-5 shrink-0" aria-hidden />
          </button>
        </div>
      )}

      <div className="sm:flex sm:items-start sm:gap-6">
        <div className="inline-flex shrink-0 rounded-pill bg-obsidian/5 p-2">
          <span className="flex size-9 items-center justify-center rounded-pill bg-cta">
            <RiRadarLine className="size-5 text-white" aria-hidden />
          </span>
        </div>

        <div className="mt-4 min-w-0 sm:mt-0">
          <h2 className="text-base font-semibold text-text sm:text-lg">
            {open ? t("title") : paid ? t("titleDone") : t("titleLocked")}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {open ? t("body") : paid ? t("bodyDone") : t("bodyLocked")}
          </p>

          {/* Ce que la reprise ne touche pas, écrit avant le clic. */}
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-steel">{t("keeps")}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            {paid ? (
              <button
                type="button"
                disabled={!open || working}
                onClick={() => execute({})}
                className="inline-flex cursor-pointer items-center justify-center rounded-pill bg-cta px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-ash disabled:shadow-none"
              >
                {working ? t("pending") : open ? t("cta") : t("ctaDone")}
              </button>
            ) : (
              <Link
                href={ROUTES.pricing}
                className="inline-flex cursor-pointer items-center justify-center rounded-pill bg-cta px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
              >
                {t("ctaLocked")}
              </Link>
            )}

            {progressHref && !working ? (
              <a
                href={progressHref}
                className="text-sm font-medium text-text underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:decoration-graphite"
              >
                {t("seeProgress")}
              </a>
            ) : null}

            {!working && paid ? (
              <span className="text-sm text-ash">{lastLabel}</span>
            ) : null}
          </div>

          {/* La barre d'attente : deux à trois minutes de crawl et d'audit, et
              rien à cliquer entre-temps. Un fil qui avance vaut mieux qu'un
              bouton grisé — il dit que quelque chose se passe. */}
          {working ? (
            <div className="mt-4 max-w-md">
              <div className="h-1 w-full overflow-hidden rounded-pill bg-pebble">
                <div className="h-full w-1/3 animate-[loading_1.4s_ease-in-out_infinite] rounded-pill bg-obsidian" />
              </div>
              <p className="mt-2 text-xs text-ash">{t("pendingHint")}</p>
            </div>
          ) : null}

          {result.serverError ? (
            <p className="mt-3 text-sm text-danger">{result.serverError}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
