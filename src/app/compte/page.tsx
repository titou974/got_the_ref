import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreColor } from "@/lib/score";
import { ROUTES } from "@/constants/routes";
import type { PlanKey } from "@/constants/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const PLAN_LABEL_KEY: Record<PlanKey, "planLabelFree" | "planLabelPro" | "planLabelAgency"> = {
  free: "planLabelFree",
  pro: "planLabelPro",
  agency: "planLabelAgency",
};

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.signIn);

  const t = await getTranslations("account");

  const analyses = await prisma.analysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const isPaid = user.plan !== "free";
  const planLabel = t(PLAN_LABEL_KEY[user.plan as PlanKey] ?? "planLabelFree");

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-8">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {t("greeting", { name: user.name ?? "👋" })}
          </h1>
          <p className="mt-1 text-muted">{user.email}</p>
        </div>

        {/* Abonnement */}
        <div className="rounded-[28px] border border-fog bg-snow p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">{t("yourPlan")}</p>
              <p className="mt-1 flex items-center gap-2 text-xl font-bold">
                {planLabel}
                {user.subscription?.status === "active" && (
                  <span className="rounded-full bg-obsidian/10 px-2 py-0.5 text-xs font-medium text-obsidian">
                    {t("active")}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              {isPaid ? (
                <BillingPortalButton label={t("manageSubscription")} />
              ) : (
                <Link
                  href={ROUTES.home}
                  className="cursor-pointer rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
                >
                  {t("upgrade")}
                </Link>
              )}
            </div>
          </div>
          {user.plan === "free" && (
            <p className="mt-4 text-sm text-muted">{t("freeHint")}</p>
          )}
        </div>

        {/* Historique */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{t("myAnalyses")}</h2>
            <Link
              href={ROUTES.home}
              className="cursor-pointer rounded-full border border-fog bg-snow px-4 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-mist"
            >
              {t("newAnalysis")}
            </Link>
          </div>

          {analyses.length === 0 ? (
            <div className="rounded-[28px] border border-fog bg-snow p-10 text-center">
              <p className="text-muted">{t("emptyState")}</p>
              <Link
                href={ROUTES.home}
                className="mt-4 inline-block cursor-pointer rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
              >
                {t("analyzeMySite")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {analyses.map((a) => (
                <li key={a.id}>
                  <Link
                    href={ROUTES.analysis(a.id)}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-fog bg-snow p-4 transition-colors duration-200 hover:bg-mist"
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold"
                      style={{ background: `${scoreColor(a.overallScore)}22`, color: scoreColor(a.overallScore) }}
                    >
                      {a.overallScore}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.businessName ?? a.domain}</p>
                      <p className="truncate text-sm text-muted">{a.domain}</p>
                    </div>
                    <span className="hidden shrink-0 text-sm text-muted sm:block">
                      {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="text-muted" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
