"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AgentRoster } from "./AgentRoster";
import { BillingCycleProvider } from "./BillingCycleContext";
import {
  GUARANTEE_DAYS,
  SUBSCRIPTION_PRICE,
  TRIAL,
  YEARLY_DISCOUNT_PCT,
  YEARLY_MONTHLY_PRICE,
  type BillingCycle,
} from "@/constants/plans";

/** Montant formaté à la française, sans décimales (79 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

function Check({ trial }: { trial: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`mt-0.5 shrink-0 ${trial ? "text-white" : "text-obsidian"}`}
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * L'abonnement « Tout-en-un », dans ses deux états.
 *
 * — `trial` : l'essai de trois jours est encore à prendre. La carte reprend
 *   alors la surface sombre et la mise en scène du prix qui allait avec — le
 *   tarif plein barré, le 0 € du jour, l'abonnement à venir en note — parce
 *   que ce qu'on propose n'est pas un abonnement mais son ouverture gratuite.
 *   Elle passe en tête des offres, le Coup de Boost la suit en carte claire.
 *
 * — sans `trial` : l'essai est passé, en cours, ou n'a jamais été proposé (on
 *   est déjà client). Il n'y a plus qu'un prix à annoncer, celui qu'on paie :
 *   79 € par mois, ou son tarif remisé à l'année. La carte redevient claire et
 *   se lit sous le Coup de Boost, qui reprend le noir.
 *
 * Dans les deux cas, l'onglet pilote le paiement : le cycle est publié dans le
 * contexte, où le bouton de checkout vient le lire (cf. `BillingCycleProvider`).
 * Le tarif annuel s'affiche **toujours par mois**, jamais en total : c'est la
 * seule unité que le visiteur compare d'un onglet à l'autre.
 */
export function PlanCard({
  cta,
  showAgents = true,
  compact = false,
  ctaNote,
  trial = false,
  className = "",
}: {
  /** Bouton d'action, rendu par le parent (checkout Stripe ou lien). */
  cta: ReactNode;
  showAgents?: boolean;
  /** Version resserrée : la carte doit tenir dans un écran quand elle est seule. */
  compact?: boolean;
  /** Remplace la note sous le bouton (le CTA n'est pas le même partout). */
  ctaNote?: string;
  /** L'essai de trois jours est proposé : carte sombre, prix du jour à 0 €. */
  trial?: boolean;
  className?: string;
}) {
  const t = useTranslations("pricing");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const features = t.raw("plan.features") as string[];
  const price = cycle === "yearly" ? YEARLY_MONTHLY_PRICE : SUBSCRIPTION_PRICE;

  const cycles: { key: BillingCycle; label: string; badge?: string }[] = [
    { key: "monthly", label: t("cycle.monthly") },
    {
      key: "yearly",
      label: t("cycle.yearly"),
      badge: t("cycle.discount", { pct: YEARLY_DISCOUNT_PCT }),
    },
  ];

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Onglets de facturation */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label={t("cycle.label")}
          className="inline-flex items-center gap-1 rounded-full border border-fog bg-snow p-1 shadow-[var(--shadow-md)]"
        >
          {cycles.map((c) => {
            const active = cycle === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCycle(c.key)}
                className={`cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${
                  active ? "bg-obsidian text-white" : "text-muted hover:text-text"
                }`}
              >
                {c.label}
                {c.badge && (
                  <span
                    className={`ml-2 text-xs font-semibold ${active ? "text-white/70" : "text-steel"}`}
                  >
                    {c.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-5 flex flex-1">
        {/* Garantie : la même promesse que la home, posée sur le bord de la
            carte. Centrée sur mobile, où la carte est trop étroite pour la
            loger dans un coin. C'est l'argument propre à l'abonnement — on ne
            rembourse pas une passe déjà livrée, on rembourse un suivi qui
            n'aurait rien donné. */}
        <div className="absolute -top-3 left-1/2 z-10 w-max -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fog bg-snow px-3.5 py-1.5 text-[11px] font-semibold text-text shadow-[var(--shadow-md)] sm:text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3l7 3v5c0 4.2-2.8 8-7 10-4.2-2-7-5.8-7-10V6l7-3z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("guaranteeBadge", { days: GUARANTEE_DAYS })}
          </span>
        </div>

        <section
          className={`flex w-full flex-col rounded-[36px] shadow-[var(--shadow-md)] ${
            trial ? "bg-obsidian text-white" : "border border-pebble bg-snow"
          } ${compact ? "p-6 pt-7 sm:p-7 sm:pt-8" : "p-6 pt-8 sm:p-9 sm:pt-10"}`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              trial ? "text-white/50" : "text-steel"
            }`}
          >
            {t("plan.eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{t("plan.name")}</h2>
          <p
            className={`mt-2 max-w-md text-sm leading-relaxed ${
              trial ? "text-white/60" : "text-muted"
            }`}
          >
            {t("plan.tagline")}
          </p>

          {trial ? (
            /* Ce qu'on paie aujourd'hui, en grand ; ce qui viendra ensuite, dessous.
               Le tarif plein du cycle choisi passe devant, barré : c'est lui qui
               donne sa valeur au 0 €. Il porte son « /mois » — depuis qu'une
               offre à paiement unique vit juste à côté, c'est ce suffixe qui dit
               d'un coup d'œil laquelle des deux est un abonnement. */
            <div
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${compact ? "mt-4" : "mt-6"}`}
            >
              <span
                className={`font-display font-bold tabular-nums tracking-tight text-white/35 line-through decoration-white/45 decoration-2 ${
                  compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
                }`}
              >
                {euros(price)}
                {/* Le suffixe reste plus petit que le montant : il qualifie le
                    tarif, il ne se compare pas au 0 € du jour. `inline-block`
                    coupe la barre du montant, qui retomberait sous ce petit
                    texte comme un soulignement : c'est le prix qui est barré,
                    pas son unité. */}
                <span className="inline-block text-[0.62em] font-semibold">{t("perMonth")}</span>
              </span>
              <span
                className={`font-display font-bold tabular-nums tracking-tight ${
                  compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
                }`}
              >
                {euros(TRIAL.todayPrice)}
              </span>
              <span className="text-base text-white/50">{t("todayLabel")}</span>
            </div>
          ) : (
            /* Un seul montant en grand, et c'est celui qu'on paie : le prix du
               cycle choisi, toujours suivi de son « /mois ». */
            <div
              className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${compact ? "mt-4" : "mt-6"}`}
            >
              <span
                className={`font-display font-bold tabular-nums tracking-tight ${
                  compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
                }`}
              >
                {euros(price)}
              </span>
              <span className="text-base text-muted">{t("perMonth")}</span>
            </div>
          )}

          {/* Trois lignes réservées, à toutes les largeurs : sans cette réserve
              la carte grandissait au changement d'onglet, et le bouton ne
              tombait plus à la même hauteur que celui du Coup de Boost. */}
          <p
            className={`min-h-[3.75rem] max-w-sm text-xs leading-relaxed ${
              trial ? "text-white/30 first-letter:uppercase" : "text-steel"
            } ${compact ? "mt-3" : "mt-4"}`}
          >
            {/* En essai, l'abonnement à venir passe en note : un seul montant
                doit se lire en grand sur cette carte, celui qu'on paie
                aujourd'hui. */}
            {trial && (
              <>
                {t("thenLabel")}{" "}
                <span className="tabular-nums">
                  {euros(price)}
                  {t("perMonth")}
                </span>
                {" · "}
              </>
            )}
            {cycle === "yearly" ? t("cycle.yearlyTerms") : t("cycle.monthlyTerms")}
          </p>

          <div className={compact ? "mt-5" : "mt-7"}>
            <BillingCycleProvider cycle={cycle}>{cta}</BillingCycleProvider>
            <p
              className={`mt-2.5 text-center text-xs ${trial ? "text-white/50" : "text-muted"}`}
            >
              {ctaNote ?? (trial ? t("plan.ctaNoteTrial", { days: TRIAL.days }) : t("plan.ctaNote"))}
            </p>
          </div>

          <ul className={`space-y-2.5 ${compact ? "mt-6" : "mt-7"}`}>
            {features.map((f) => (
              <li
                key={f}
                className={`flex items-start gap-2.5 text-sm ${trial ? "text-white/85" : "text-ink"}`}
              >
                <Check trial={trial} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* Collé au bas de la carte : l'espace en trop tombe au-dessus de ce
              bloc, jamais entre deux lignes de la liste. La phrase répond mot
              pour mot à la note de périmètre du Coup de Boost : l'une s'arrête,
              l'autre non. En tête des offres, la carte porte le roster
              d'agents — c'est elle qu'on met en avant, elle a la place. */}
          {showAgents && (
            <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
              {trial && <AgentRoster />}
              <p
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  trial ? "bg-white/5 text-white/45" : "bg-mist text-steel"
                }`}
              >
                {t("agents.note")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
