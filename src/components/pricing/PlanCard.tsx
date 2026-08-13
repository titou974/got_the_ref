"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AgentRoster } from "./AgentRoster";
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
 * Le montant en grand est toujours celui qu'on paie aujourd'hui — 1 € de frais
 * de serveur IA pour l'essai. L'onglet ne change que la suite : au mois, le
 * tarif plein ; à l'année, le tarif remisé, affiché **par mois** et jamais en
 * total annuel, avec le tarif mensuel barré à côté pour que l'écart se lise
 * d'un coup d'œil.
 *
 * ⚠️ Les onglets ne pilotent que l'affichage : aucun price Stripe annuel n'est
 * branché (cf. `YEARLY_MONTHLY_PRICE`), le checkout part sur le mensuel.
 */
export function PlanCard({
  cta,
  showAgents = true,
  className = "",
}: {
  /** Bouton d'action, rendu par le parent (checkout Stripe ou lien). */
  cta: ReactNode;
  showAgents?: boolean;
  className?: string;
}) {
  const t = useTranslations("pricing");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const features = t.raw("plan.features") as string[];

  const cycles: { key: BillingCycle; label: string; badge?: string }[] = [
    { key: "monthly", label: t("cycle.monthly") },
    { key: "yearly", label: t("cycle.yearly"), badge: t("cycle.discount", { pct: YEARLY_DISCOUNT_PCT }) },
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

      <div className="relative mt-5">
        {/* Garantie : la même promesse que la home, posée sur le bord de la carte. */}
        {/* Centrée sur mobile, où la carte est trop étroite pour la loger dans un coin. */}
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

        <section className="rounded-[36px] bg-obsidian p-6 pt-8 text-white shadow-[var(--shadow-md)] sm:p-9 sm:pt-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {t("plan.eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{t("plan.name")}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">{t("plan.tagline")}</p>

          {/* Ce qu'on paie aujourd'hui, en grand ; ce qui viendra ensuite, dessous. */}
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
              {euros(TRIAL.activationPrice)}
            </span>
            <span className="text-base text-white/50">{t("todayLabel")}</span>
          </div>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/45">
            {t("serverFeeNote", { days: TRIAL.days })}
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-sm text-white/50">{t("thenLabel")}</span>
            {cycle === "yearly" && (
              <span className="text-base tabular-nums text-white/35 line-through">
                {euros(SUBSCRIPTION_PRICE)}
                {t("perMonth")}
              </span>
            )}
            <span className="font-display text-2xl font-bold tabular-nums">
              {euros(cycle === "yearly" ? YEARLY_MONTHLY_PRICE : SUBSCRIPTION_PRICE)}
              <span className="text-base font-medium text-white/60">{t("perMonth")}</span>
            </span>
          </div>
          <p className="mt-1.5 text-sm text-white/60">
            {cycle === "yearly" ? t("cycle.yearlyTerms") : t("cycle.monthlyTerms")}
          </p>
          <p className="mt-1 text-xs text-white/40">{t("vat")}</p>

          <div className="mt-7">
            {cta}
            <p className="mt-2.5 text-center text-xs text-white/50">{t("plan.ctaNote")}</p>
          </div>

          <ul className="mt-7 space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
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
