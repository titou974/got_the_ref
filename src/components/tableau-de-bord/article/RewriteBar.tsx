"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";
import { SearchLoader } from "@/components/SearchLoader";

/**
 * La consigne de réécriture, en une ligne au-dessus de la décision.
 *
 * C'était une carte de la colonne de gauche : un titre, une phrase
 * d'explication, une zone de saisie sur trois lignes, le mot-clé, un bouton, le
 * budget de la semaine. Sept éléments pour une phrase à dicter. Or on ne
 * demande une reprise qu'après avoir lu le texte, et le texte se lit au milieu
 * de l'écran : la consigne descend donc au pied de la page, à côté du bouton qui
 * décide du sort de l'article, et se réduit à ce qu'elle est — un champ et un
 * verbe.
 *
 * Le budget reste sous le champ, en petit : il pèse dans la décision de relancer
 * une reprise, et nulle part ailleurs.
 */

export function RewriteBar({
  value,
  onChange,
  onSubmit,
  pending,
  disabled,
  remaining,
  renewsAt,
  locked,
  beyondPlan,
  hasBody,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  /** Une autre action est en cours : la reprise attend son tour. */
  disabled: boolean;
  /** Rédactions encore disponibles cette semaine. */
  remaining: number;
  /**
   * Quand la prochaine rédaction se libère, déjà mise en forme — « lundi 8
   * septembre à 09:00 ».
   *
   * Nulle quand il n'y a rien à attendre : la semaine du Coup de Boost s'est
   * refermée, et la suite s'appelle l'abonnement. La distinction compte, une
   * date dirait « revenez lundi » là où plus rien ne se renouvellera.
   */
  renewsAt: string | null;
  /** L'offre du compte n'ouvre pas la rédaction : le champ mène aux tarifs. */
  locked: boolean;
  /**
   * L'offre rédige, mais pas cet article-là : le Coup de Boost au-delà de sa
   * première semaine. Le champ mène alors à l'abonnement.
   */
  beyondPlan: boolean;
  /**
   * L'article a déjà un texte.
   *
   * Sans lui, la barre demandait « ce qui ne va pas » devant une page blanche et
   * son bouton disait « réécrire » : le premier geste de l'atelier, celui qui
   * fait écrire l'article, se présentait comme une correction.
   */
  hasBody: boolean;
}) {
  const t = useTranslations("dashboard.article");

  // Deux portes fermées, deux raisons différentes. L'offre n'ouvre pas du tout
  // la rédaction, ou elle l'ouvre mais s'arrête avant cet article-là : dire
  // « débloquez la rédaction » à un client qui a déjà payé le Coup de Boost et
  // lit cinq articles rédigés lui donnerait tort.
  if (locked || beyondPlan) {
    return (
      <div className="pointer-events-auto w-full max-w-[43rem]">
        <Link
          href={ROUTES.pricing}
          className="block w-full cursor-pointer rounded-pill border border-border bg-snow px-[18px] py-3 text-center text-sm font-medium shadow-[rgba(0,0,0,0.06)_0_4px_14px] transition-colors duration-200 hover:bg-mist"
        >
          {beyondPlan ? t("unlockAllIn") : t("unlockToWrite")}
        </Link>
        <p className="mx-auto mt-2 w-fit max-w-full rounded-3xl bg-snow/95 px-3 py-1.5 text-center text-xs leading-relaxed text-muted backdrop-blur">
          {beyondPlan ? t("beyondPlanQuota") : t("lockedQuota")}
        </p>
      </div>
    );
  }

  const spent = remaining <= 0;

  return (
    <div className="pointer-events-auto w-full max-w-[43rem]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !disabled && !spent) onSubmit();
        }}
        className="flex items-center gap-2 rounded-pill border border-border bg-snow py-1.5 pl-[18px] pr-1.5 shadow-[rgba(0,0,0,0.10)_0_10px_28px]"
      >
        <input
          type="text"
          value={value}
          disabled={spent}
          onChange={(event) => onChange(event.target.value)}
          placeholder={hasBody ? t("rewriteHint") : t("writeHint")}
          aria-label={hasBody ? t("rewrite") : t("writeCta")}
          className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-ash focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={pending || disabled || spent}
          className="shrink-0 cursor-pointer rounded-pill bg-cta px-[18px] py-2.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-mist disabled:text-steel"
        >
          {pending ? t("writing") : hasBody ? t("rewriteCta") : t("writeCta")}
        </button>
      </form>

      {/* Le budget porte son propre fond : sur grand écran, la barre flotte
          au-dessus du texte de l'article, et une ligne posée à nu s'y lisait
          par-dessus les mots.

          Épuisé, il dit quand la prochaine se libère et ce qui continue de
          tourner sans lui. « Rédactions épuisées » laissait le client devant une
          porte fermée sans date : il ne savait ni s'il fallait revenir demain ou
          le mois prochain, ni si ses articles à venir s'écriraient quand même —
          et ils s'écrivent, c'est ce que l'abonnement fait chaque semaine. */}
      <p className="mx-auto mt-2 w-fit max-w-full rounded-3xl bg-snow/95 px-3 py-1.5 text-center text-xs leading-relaxed text-muted backdrop-blur">
        {spent
          ? renewsAt
            ? t("quotaSpent", { date: renewsAt })
            : t("quotaSpentBoost")
          : t(hasBody ? "quotaLeftRewrite" : "quotaLeftWrite", { count: remaining })}
      </p>

      {pending ? (
        <SearchLoader kind="writing" compact title={t("writing")} className="mt-2" />
      ) : null}
    </div>
  );
}
