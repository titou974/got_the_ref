"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BillingCycleProvider } from "./BillingCycleContext";
import {
  GUARANTEE_DAYS,
  SUBSCRIPTION_PRICE,
  YEARLY_DISCOUNT_PCT,
  YEARLY_MONTHLY_PRICE,
  type BillingCycle,
} from "@/constants/plans";

/** Montant formaté à la française, sans décimales (79 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="mt-0.5 shrink-0 text-obsidian"
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
 * L'abonnement « Tout-en-un », en carte claire, sous le Coup de Boost.
 *
 * Elle a perdu deux choses. La surface sombre, passée à la passe unique : c'est
 * elle qu'on met en avant, et deux cartes noires ne mettent rien en avant. Et
 * l'essai gratuit, avec son « 0 € aujourd'hui » posé devant un tarif barré —
 * une mise en scène qui vendait une date d'échéance plutôt qu'un produit. Ce
 * qu'on montre maintenant est le prix qu'on paie : 79 € par mois, ou son tarif
 * remisé si l'on s'engage à l'année.
 *
 * L'onglet ne change que ce montant et la ligne de conditions. Il pilote aussi
 * le paiement : le cycle est publié dans le contexte, où le bouton de checkout
 * vient le lire (cf. `BillingCycleProvider`). Le tarif annuel s'affiche
 * **toujours par mois**, jamais en total : c'est la seule unité que le visiteur
 * compare d'un onglet à l'autre.
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
          className={`flex w-full flex-col rounded-[36px] border border-pebble bg-snow shadow-[var(--shadow-md)] ${
            compact ? "p-6 pt-7 sm:p-7 sm:pt-8" : "p-6 pt-8 sm:p-9 sm:pt-10"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("plan.eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{t("plan.name")}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{t("plan.tagline")}</p>

          {/* Un seul montant en grand, et c'est celui qu'on paie : le prix du
              cycle choisi, toujours suivi de son « /mois ». C'est ce suffixe
              qui dit d'un coup d'œil laquelle des deux offres est un
              abonnement. */}
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

          {/* Même réserve de hauteur que la note du Coup de Boost, au-dessus :
              sans elle, la carte grandissait au changement d'onglet. */}
          <p
            className={`min-h-[3.75rem] max-w-sm text-xs leading-relaxed text-steel ${
              compact ? "mt-3" : "mt-4"
            }`}
          >
            {cycle === "yearly" ? t("cycle.yearlyTerms") : t("cycle.monthlyTerms")}
            {" · "}
            {t("vat")}
          </p>

          <div className={compact ? "mt-5" : "mt-7"}>
            <BillingCycleProvider cycle={cycle}>{cta}</BillingCycleProvider>
            <p className="mt-2.5 text-center text-xs text-muted">
              {ctaNote ?? t("plan.ctaNote")}
            </p>
          </div>

          <ul className={`space-y-2.5 ${compact ? "mt-6" : "mt-7"}`}>
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* Collé au bas de la carte : l'espace en trop tombe au-dessus de ce
              bloc, jamais entre deux lignes de la liste. La phrase répond mot
              pour mot à la note de périmètre du Coup de Boost, au-dessus :
              l'une s'arrête, l'autre non. */}
          {showAgents && (
            <div className="mt-6 flex flex-1 flex-col justify-end">
              <p className="rounded-2xl bg-mist px-4 py-3 text-xs leading-relaxed text-steel">
                {t("agents.note")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
