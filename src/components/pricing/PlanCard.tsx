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

/** Montant formaté à la française, sans décimales (20 000 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="mt-0.5 shrink-0 text-white"
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
 * La carte d'abonnement, seule surface sombre du site : la chose qui ne
 * s'arrête jamais. Elle vit sur la page tarifs et en bas de la home.
 *
 * Le montant en grand est toujours celui qu'on paie aujourd'hui — 0 €, l'essai
 * étant gratuit —, précédé du tarif plein barré pour que la remise se lise d'un
 * coup d'œil. L'onglet ne change que le tarif barré et la suite : au mois, le
 * tarif plein ; à l'année, le tarif remisé, affiché **par mois** et jamais en
 * total annuel.
 *
 * L'onglet pilote aussi le paiement : le cycle est publié dans le contexte, où
 * le bouton de checkout vient le lire (cf. `BillingCycleProvider`).
 */
export function PlanCard({
  cta,
  showAgents = true,
  compact = false,
  ctaNote,
  className = "",
}: {
  /** Bouton d'action, rendu par le parent (checkout Stripe ou lien). */
  cta: ReactNode;
  showAgents?: boolean;
  /** Version resserrée : la carte doit tenir dans un écran quand elle est seule. */
  compact?: boolean;
  /** Remplace la note sous le bouton (le CTA n'est pas le même partout). */
  ctaNote?: string;
  className?: string;
}) {
  const t = useTranslations("pricing");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const features = t.raw("plan.features") as string[];

  const cycles: { key: BillingCycle; label: string; badge?: string }[] = [
    { key: "monthly", label: t("cycle.monthly") },
    {
      key: "yearly",
      label: t("cycle.yearly"),
      badge: t("cycle.discount", { pct: YEARLY_DISCOUNT_PCT }),
    },
  ];

  return (
    <div className={className}>
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
                  active
                    ? "bg-obsidian text-white"
                    : "text-muted hover:text-text"
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

      <div className="relative mt-5">
        {/* Garantie : la même promesse que la home, posée sur le bord de la carte. */}
        {/* Centrée sur mobile, où la carte est trop étroite pour la loger dans un coin. */}
        <div className="absolute -top-3 left-1/2 z-10 w-max -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fog bg-snow px-3.5 py-1.5 text-[11px] font-semibold text-text shadow-[var(--shadow-md)] sm:text-xs">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
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
          className={`rounded-[36px] bg-obsidian text-white shadow-[var(--shadow-md)] ${
            compact ? "p-6 pt-7 sm:p-7 sm:pt-8" : "p-6 pt-8 sm:p-9 sm:pt-10"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {t("plan.eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{t("plan.name")}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
            {t("plan.tagline")}
          </p>

          {/* Ce qu'on paie aujourd'hui, en grand ; ce qui viendra ensuite, dessous.
              Le tarif plein du cycle choisi passe devant, barré : c'est lui qui
              donne sa valeur au 0 €. */}
          <div
            className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${compact ? "mt-4" : "mt-6"}`}
          >
            <span
              className={`font-display font-bold tabular-nums tracking-tight text-white/35 line-through decoration-white/45 decoration-2 ${
                compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
              }`}
            >
              {euros(
                cycle === "yearly" ? YEARLY_MONTHLY_PRICE : SUBSCRIPTION_PRICE,
              )}
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

          {/* L'abonnement à venir passe en note, du même gris que les frais de
              serveur : un seul montant doit se lire en grand sur cette carte,
              celui qu'on paie aujourd'hui. Le tarif remisé reste distingué du
              tarif plein, par la graisse plutôt que par la taille. */}
          {/* Trois lignes réservées tant que la carte est étroite : la mention
              annuelle est plus longue que la mensuelle, et sans cette réserve la
              carte grandissait de 19 px au changement d'onglet. Au-delà de `sm`
              les deux tiennent sur deux lignes, la réserve devient inutile. */}
          <p
            className={`min-h-[3.75rem] max-w-sm text-xs leading-relaxed text-white/30 first-letter:uppercase sm:min-h-0 ${
              compact ? "mt-3" : "mt-4"
            }`}
          >
            {t("thenLabel")}{" "}
            <span className="tabular-nums">
              {euros(
                cycle === "yearly" ? YEARLY_MONTHLY_PRICE : SUBSCRIPTION_PRICE,
              )}
              {t("perMonth")}
            </span>
            {" · "}
            {cycle === "yearly"
              ? t("cycle.yearlyTerms")
              : t("cycle.monthlyTerms")}
            {" · "}
            {t("vat")}
          </p>

          <div className={compact ? "mt-5" : "mt-7"}>
            <BillingCycleProvider cycle={cycle}>{cta}</BillingCycleProvider>
            <p className="mt-2.5 text-center text-xs text-white/50">
              {ctaNote ?? t("plan.ctaNote", { days: TRIAL.days })}
            </p>
          </div>

          <ul className={`space-y-2.5 ${compact ? "mt-6" : "mt-7"}`}>
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 text-sm text-white/85"
              >
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {showAgents && (
            <div className="mt-7">
              <AgentRoster />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
