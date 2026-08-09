import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookCallButton } from "@/components/BookCallButton";
import { AnalysisCheckoutButton } from "@/components/AnalysisCheckoutButton";
import { REDIRECT_REASONS, ROUTES } from "@/constants/routes";
import { ANALYSIS_PRICE } from "@/constants/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ raison?: string; analyse?: string }> };

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0">
      <circle cx="10" cy="10" r="9" fill="#11b48c" opacity="0.2" />
      <path d="M6 10.5 8.5 13 14 7" stroke="#11b48c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-6 flex-1 space-y-3 text-sm">
      {features.map((f) => (
        <li key={f} className="flex gap-2">
          <Check />
          <span className="text-muted">{f}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function TarifsPage({ searchParams }: Props) {
  const { raison, analyse } = await searchParams;
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");
  const features = (plan: "pro" | "agency") => t.raw(`${plan}.features`) as string[];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">
            {t("headingBefore")}
            <span className="text-gradient">{t("headingHighlight")}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">{t("subtitle")}</p>
          {raison === REDIRECT_REASONS.quota && (
            <p className="mx-auto mt-5 max-w-md rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              {t("quotaNote")}
            </p>
          )}
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* Une analyse : paiement unique, après l'aperçu gratuit */}
          <div className="relative flex flex-col rounded-[28px] border-2 border-obsidian bg-snow p-6 shadow-[var(--shadow-md)]">
            <h2 className="text-lg font-semibold">{t("pro.name")}</h2>
            <p className="mt-2">
              <span className="font-display text-4xl font-bold">{ANALYSIS_PRICE}€</span>
              <span className="text-muted">{t("perOnce")}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{t("pro.description")}</p>
            <FeatureList features={features("pro")} />
            <div className="mt-6">
              {analyse ? (
                // Venu d'un rapport précis : ce bouton ouvre directement le paiement de CETTE analyse.
                <AnalysisCheckoutButton analysisId={analyse} />
              ) : (
                // Pas d'analyse en cours : on commence toujours par l'aperçu gratuit.
                <Link
                  href={ROUTES.home}
                  className="block w-full cursor-pointer rounded-full bg-cta py-3 text-center font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
                >
                  {t("pro.cta")}
                </Link>
              )}
              <p className="mt-2 text-center text-xs text-muted">{t("pro.ctaNote")}</p>
            </div>
          </div>

          {/* Agence : aucun prix public, uniquement sur rendez-vous */}
          <div className="flex flex-col rounded-[28px] border border-fog bg-snow p-6">
            <h2 className="text-lg font-semibold">{t("agency.name")}</h2>
            <p className="mt-2">
              <span className="font-display text-4xl font-bold">{t("agency.price")}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{t("agency.description")}</p>
            <FeatureList features={features("agency")} />
            <div className="mt-6">
              <BookCallButton label={tc("bookCall")} variant="secondary" className="w-full" />
              <p className="mt-2 text-center text-xs text-muted">{t("agency.ctaNote")}</p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">{t("secureNote")}</p>
      </div>
      <Footer />
    </main>
  );
}
