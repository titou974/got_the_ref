import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CheckoutButton } from "@/components/CheckoutButton";
import { ROUTES, REDIRECT_REASONS } from "@/constants/routes";
import { PLAN_PRICING } from "@/constants/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ raison?: string }> };

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
  const { raison } = await searchParams;
  const t = await getTranslations("pricing");
  const features = (plan: "free" | "pro" | "agency") =>
    t.raw(`${plan}.features`) as string[];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
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

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Gratuit */}
          <div className="flex flex-col rounded-[28px] border border-fog bg-snow p-6">
            <h2 className="text-lg font-semibold">{t("free.name")}</h2>
            <p className="mt-2">
              <span className="font-display text-4xl font-bold">{PLAN_PRICING.free.monthly}€</span>
              <span className="text-muted">{t("perMonth")}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{t("free.description")}</p>
            <FeatureList features={features("free")} />
            <Link
              href={ROUTES.signUp}
              className="mt-6 cursor-pointer rounded-full border border-graphite py-3 text-center font-medium text-graphite transition-colors duration-200 hover:bg-mist"
            >
              {t("free.cta")}
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-[28px] border-2 border-obsidian bg-snow p-6 shadow-[var(--shadow-md)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cta px-3 py-1 text-xs font-semibold text-white">
              {t("popularBadge")}
            </span>
            <h2 className="text-lg font-semibold">{t("pro.name")}</h2>
            <p className="mt-2">
              <span className="font-display text-4xl font-bold">{PLAN_PRICING.pro.monthly}€</span>
              <span className="text-muted">{t("perMonth")}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{t("pro.description")}</p>
            <FeatureList features={features("pro")} />
            <div className="mt-6">
              <CheckoutButton plan="pro" label={t("pro.cta")} highlighted />
            </div>
          </div>

          {/* Agence */}
          <div className="flex flex-col rounded-[28px] border border-fog bg-snow p-6">
            <h2 className="text-lg font-semibold">{t("agency.name")}</h2>
            <p className="mt-2">
              <span className="font-display text-4xl font-bold">{PLAN_PRICING.agency.monthly}€</span>
              <span className="text-muted">{t("perMonth")}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{t("agency.description")}</p>
            <FeatureList features={features("agency")} />
            <div className="mt-6">
              <CheckoutButton plan="agency" label={t("agency.cta")} />
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">{t("secureNote")}</p>
      </div>
      <Footer />
    </main>
  );
}
