import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AnalysisCheckoutButton } from "@/components/AnalysisCheckoutButton";
import { AgentRoster } from "@/components/pricing/AgentRoster";
import { REDIRECT_REASONS, ROUTES } from "@/constants/routes";
import {
  AGENCY_BENCHMARK_YEARLY,
  ANNUAL_SAVING_AMOUNT,
  ANNUAL_SAVING_PERCENT,
  SUBSCRIPTION_PRICING,
  TRIAL,
  type BillingCycle,
} from "@/constants/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ raison?: string; analyse?: string }> };

/** Montant formaté à la française, sans décimales (20 000 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

export default async function TarifsPage({ searchParams }: Props) {
  const { raison, analyse } = await searchParams;
  const t = await getTranslations("pricing");

  const features = t.raw("plan.features") as string[];
  const annualExtras = t.raw("annual.extras") as string[];
  const agencyLimits = t.raw("agency.limits") as string[];
  const rows = t.raw("compare.rows") as { label: string; visia: string; agency: string }[];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:py-16">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-balance text-3xl font-bold leading-[1.1] sm:text-[40px]">
            {t("headingBefore")}
            <span className="text-gradient">{t("headingHighlight")}</span>
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted">{t("subtitle")}</p>
          {raison === REDIRECT_REASONS.quota && (
            <p className="mt-6 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning">
              {t("quotaNote")}
            </p>
          )}
        </header>

        {/* Les deux formules du même abonnement : seule la périodicité change. */}
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          <PlanCard
            cycle="monthly"
            eyebrow={t("plan.monthlyEyebrow")}
            name={t("plan.monthlyName")}
            strikePerMonth={SUBSCRIPTION_PRICING.monthly.perMonth}
            terms={t("plan.monthlyTerms", {
              days: TRIAL.days,
              price: euros(SUBSCRIPTION_PRICING.monthly.charged),
            })}
            trialLabel={t("trialPrefix")}
            perMonthLabel={t("perMonth")}
            vat={t("vat")}
            cta={t("trialCta", { price: euros(TRIAL.activationPrice) })}
            analysisId={analyse}
            featuresTitle={t("plan.featuresTitle")}
            features={features}
          >
            <div className="mt-7">
              <AgentRoster />
            </div>
          </PlanCard>

          <PlanCard
            cycle="annual"
            eyebrow={t("annual.eyebrow")}
            name={t("annual.name")}
            badge={t("annual.badge", { percent: ANNUAL_SAVING_PERCENT })}
            strikePerMonth={SUBSCRIPTION_PRICING.annual.perMonth}
            terms={t("annual.terms", {
              days: TRIAL.days,
              price: euros(SUBSCRIPTION_PRICING.annual.charged),
            })}
            fineprint={t("annual.saving", {
              amount: euros(ANNUAL_SAVING_AMOUNT),
              percent: ANNUAL_SAVING_PERCENT,
            })}
            trialLabel={t("trialPrefix")}
            perMonthLabel={t("perMonth")}
            vat={t("vat")}
            cta={t("trialCta", { price: euros(TRIAL.activationPrice) })}
            analysisId={analyse}
            featuresTitle={t("annual.featuresTitle")}
            features={annualExtras}
          />
        </div>

        {/* Le repère : ce n'est pas une offre, c'est ce que coûte l'alternative. */}
        <section
          className="relative mt-5 overflow-hidden rounded-[36px] border border-fog bg-mist p-6 sm:p-8"
          // Hachures : la carte est là pour être lue, pas pour être choisie.
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(9,9,11,0.025) 0 1px, transparent 1px 9px)",
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-ash">
                {t("agency.eyebrow")}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-steel">{t("agency.name")}</h2>
              <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-4xl font-bold tabular-nums tracking-tight text-ash">
                  {euros(AGENCY_BENCHMARK_YEARLY.min)}
                  <span className="text-ash"> – </span>
                  {euros(AGENCY_BENCHMARK_YEARLY.max)}
                </span>
                <span className="text-base text-ash">{t("perYear")}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-steel">{t("agency.description")}</p>
              <p className="mt-4 inline-block rounded-full border border-pebble px-4 py-2 text-xs text-ash">
                {t("agency.notForSale")}
              </p>
            </div>

            <ul className="space-y-2.5 lg:max-w-sm">
              {agencyLimits.map((l) => (
                <li key={l} className="flex items-start gap-2.5 text-sm text-steel">
                  <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-pebble" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comparatif chiffré : chaque ligne est une différence réelle, pas un argument. */}
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("compare.title")}
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-fog">
                  <th className="py-3 pr-4 font-medium text-muted">{t("compare.criterion")}</th>
                  <th className="py-3 pr-4 font-semibold text-text">{t("compare.visiaColumn")}</th>
                  <th className="py-3 font-medium text-ash">{t("compare.agencyColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-fog last:border-0">
                    <td className="py-3.5 pr-4 text-muted">{row.label}</td>
                    <td className="py-3.5 pr-4 font-semibold tabular-nums text-text">{row.visia}</td>
                    <td className="py-3.5 tabular-nums text-ash">{row.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-10 text-sm text-muted">
          {t("secureNote", { days: TRIAL.days })}
        </p>
      </div>

      <Footer />
    </main>
  );
}

/**
 * Une formule d'abonnement. Le montant mis en avant est celui réellement
 * débité aujourd'hui — les frais d'activation de l'essai ; le tarif récurrent
 * apparaît barré à côté, et l'échéance en toutes lettres juste en dessous.
 */
function PlanCard({
  cycle,
  eyebrow,
  name,
  badge,
  strikePerMonth,
  terms,
  fineprint,
  trialLabel,
  perMonthLabel,
  vat,
  cta,
  analysisId,
  featuresTitle,
  features,
  children,
}: {
  cycle: BillingCycle;
  eyebrow: string;
  name: string;
  badge?: string;
  strikePerMonth: number;
  terms: string;
  fineprint?: string;
  trialLabel: string;
  perMonthLabel: string;
  vat: string;
  cta: string;
  analysisId?: string;
  featuresTitle: string;
  features: string[];
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[36px] bg-obsidian p-6 text-white shadow-[var(--shadow-md)] sm:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{eyebrow}</p>
        {badge && (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            {badge}
          </span>
        )}
      </div>
      <h2 className="mt-2 text-2xl font-bold">{name}</h2>

      {/* Ce qu'on paie maintenant, en grand ; le tarif à venir, barré. */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-5xl font-bold tabular-nums tracking-tight">
          {trialLabel}
        </span>
        <span className="text-lg text-white/40 line-through tabular-nums">
          {strikePerMonth} €{perMonthLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/40">{vat}</p>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{terms}</p>
      {fineprint && <p className="mt-1 text-xs text-white/45">{fineprint}</p>}

      <div className="mt-6">
        {analysisId ? (
          // Venu d'un rapport précis : on le rattache à l'abonnement souscrit.
          <AnalysisCheckoutButton analysisId={analysisId} cycle={cycle} label={cta} />
        ) : (
          <Link
            href={ROUTES.home}
            className="block w-full cursor-pointer rounded-full bg-white py-3 text-center font-medium text-obsidian transition-colors duration-200 hover:bg-white/90"
          >
            {cta}
          </Link>
        )}
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-white/50">
        {featuresTitle}
      </p>
      <ul className="mt-3 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
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
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {children}
    </section>
  );
}
