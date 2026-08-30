import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext, listGooglePosts } from "@/features/dashboard/queries";
import { Card, CardTitle, PageHeader, StatusDot } from "@/components/tableau-de-bord/Card";
import { GooglePostPlanner } from "@/components/tableau-de-bord/GooglePostPlanner";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Google Maps : la fiche du commerce, sa cohérence avec le site, et les posts à
 * venir. Section réservée aux commerces qui ont une adresse : un site sans
 * établissement n'a pas de fiche à tenir.
 */
export default async function GoogleMapsPage() {
  const user = await requireUser();
  const [context, posts] = await Promise.all([
    getDashboardContext(user.id),
    listGooglePosts(user.id),
  ]);

  if (!context.isPhysical) notFound();

  const t = await getTranslations("dashboard.maps");
  if (!context.analysis) return <PreparingAnalysis tier={context.tier} />;

  const analysis = context.analysis;
  const coherence = analysis.mapsCoherence ?? null;

  // La fiche se tient semaine après semaine : réservée à l'abonnement.
  const locked = !canOpen(context.tier, "maps");
  const keyword = analysis.trendingKeywords?.keywords[0]?.keyword ?? null;

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      <SectionGate section="maps" locked={locked}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            title={t("listing")}
            hint={coherence?.summary ?? t("noListing")}
            action={
              coherence ? (
                <span className="rounded-xl bg-mist px-3 py-1 text-sm font-semibold tabular-nums">
                  {coherence.score}
                </span>
              ) : undefined
            }
          />

          {coherence ? (
            <>
              <dl className="mb-4 grid grid-cols-3 gap-3 border-b border-border pb-4">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-steel">{t("name")}</dt>
                  <dd className="mt-1 truncate text-sm font-medium">
                    {coherence.listingName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-steel">{t("rating")}</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {coherence.rating !== null ? coherence.rating.toFixed(1) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-steel">{t("reviews")}</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {coherence.reviewCount ?? "—"}
                  </dd>
                </div>
              </dl>

              <ul className="divide-y divide-border">
                {coherence.matches.map((match) => (
                  <li key={match.label} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <StatusDot status={match.consistent ? "ok" : "ko"} />
                      <span className="truncate text-sm">{match.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{match.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
              {t("noListingBody")}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle title={t("optimize")} hint={t("optimizeHint")} />
          {keyword ? (
            <>
              <p className="text-sm">
                {t("keywordLine", { keyword })}
              </p>
              <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-sm">
                {t("titleSuggestion", {
                  business: analysis.businessName,
                  keyword,
                  city: analysis.profile.location ?? context.cities[0] ?? "",
                })}
              </p>
              <p className="mt-3 text-xs text-muted">{t("optimizeNote")}</p>
            </>
          ) : (
            <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
              {t("noKeyword")}
            </p>
          )}
        </Card>
      </div>

      <GooglePostPlanner
        posts={posts.map((post) => ({
          id: post.id,
          title: post.title,
          body: post.body,
          cta: post.cta,
          keyword: post.keyword,
          status: post.status,
          scheduledFor: post.scheduledFor?.toISOString() ?? null,
        }))}
      />
      </SectionGate>
    </>
  );
}
