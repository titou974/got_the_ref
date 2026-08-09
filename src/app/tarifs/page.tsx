import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AnalysisCheckoutButton } from "@/components/AnalysisCheckoutButton";
import { AgentRoster } from "@/components/pricing/AgentRoster";
import { REDIRECT_REASONS, ROUTES } from "@/constants/routes";
import { AGENCY_BENCHMARK_PRICE, SUBSCRIPTION_PRICE } from "@/constants/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ raison?: string; analyse?: string }> };

/** Montant formaté à la française, sans décimales (2 000 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

export default async function TarifsPage({ searchParams }: Props) {
  const { raison, analyse } = await searchParams;
  const t = await getTranslations("pricing");

  const features = t.raw("plan.features") as string[];
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

        {/* Les deux voies : ce qui tourne en continu, face à ce qui attend. */}
        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          {/* Visia — seule surface sombre du site : la chose qui ne s'arrête jamais. */}
          <section className="rounded-[36px] bg-obsidian p-6 text-white shadow-[var(--shadow-md)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
              {t("plan.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-bold">{t("plan.name")}</h2>

            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-5xl font-bold tabular-nums tracking-tight">
                {euros(SUBSCRIPTION_PRICE)}
              </span>
              <span className="text-base text-white/55">{t("perMonth")}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{t("plan.description")}</p>

            <div className="mt-6">
              {analyse ? (
                // Venu d'un rapport précis : on le rattache à l'abonnement souscrit.
                <AnalysisCheckoutButton analysisId={analyse} />
              ) : (
                <Link
                  href={ROUTES.home}
                  className="block w-full cursor-pointer rounded-full bg-white py-3 text-center font-medium text-obsidian transition-colors duration-200 hover:bg-white/90"
                >
                  {t("plan.cta")}
                </Link>
              )}
              <p className="mt-2.5 text-center text-xs text-white/50">{t("plan.ctaNote")}</p>
            </div>

            <ul className="mt-7 space-y-2.5">
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

            <div className="mt-7">
              <AgentRoster />
            </div>
          </section>

          {/* Le repère : ce n'est pas une offre, c'est ce que coûte l'alternative. */}
          <section
            className="relative overflow-hidden rounded-[36px] border border-fog bg-mist p-6 sm:p-8"
            // Hachures : la carte est là pour être lue, pas pour être choisie.
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(9,9,11,0.025) 0 1px, transparent 1px 9px)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-ash">
              {t("agency.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-steel">{t("agency.name")}</h2>

            <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-sm text-ash">{t("agency.from")}</span>
              <span className="font-display text-5xl font-bold tabular-nums tracking-tight text-ash">
                {euros(AGENCY_BENCHMARK_PRICE)}
              </span>
              <span className="text-base text-ash">{t("perMonth")}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-steel">{t("agency.description")}</p>

            <div className="mt-6 rounded-full border border-pebble px-4 py-3 text-center text-sm text-ash">
              {t("agency.notForSale")}
            </div>

            <ul className="mt-7 space-y-2.5">
              {agencyLimits.map((l) => (
                <li key={l} className="flex items-start gap-2.5 text-sm text-steel">
                  <span
                    aria-hidden
                    className="mt-2.5 h-px w-3 shrink-0 bg-pebble"
                  />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

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
                  <th className="py-3 pr-4 font-semibold text-text">{t("plan.name")}</th>
                  <th className="py-3 font-medium text-ash">{t("compare.agencyColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-fog last:border-0">
                    <td className="py-3.5 pr-4 text-muted">{row.label}</td>
                    <td className="py-3.5 pr-4 font-semibold text-text tabular-nums">{row.visia}</td>
                    <td className="py-3.5 text-ash tabular-nums">{row.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-10 text-sm text-muted">{t("secureNote")}</p>
      </div>

      <Footer />
    </main>
  );
}
