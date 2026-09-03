import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  businessHint,
  getDashboardContext,
  getMapsPlace,
  listGooglePosts,
} from "@/features/dashboard/queries";
import { Card, CardTitle, PageHeader, StatusDot } from "@/components/tableau-de-bord/Card";
import { GooglePostPlanner } from "@/components/tableau-de-bord/GooglePostPlanner";
import { GooglePlacePanel } from "@/components/tableau-de-bord/maps/GooglePlacePanel";
import {
  PlaceCompleteness,
  PlacePopularTimes,
  PlaceReviewWords,
} from "@/components/tableau-de-bord/maps/PlaceInsights";
import { SyncPlaceButton } from "@/components/tableau-de-bord/maps/SyncPlaceButton";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { canOpen } from "@/constants/access";
import { ROUTES } from "@/constants/routes";

export const maxDuration = 300;

/**
 * Google Maps : la fiche du commerce, d'abord.
 *
 * L'écran s'ouvre sur la fiche elle-même, relevée chez Google et remontée dans
 * sa propre grammaire — c'est ce que le commerçant reconnaît sans lire. Les
 * cartes de droite disent ensuite ce qu'il faudrait y changer, et le calendrier
 * de posts ferme la page.
 *
 * Section réservée aux commerces qui ont une adresse : un site sans
 * établissement n'a pas de fiche à tenir.
 */
export default async function GoogleMapsPage() {
  const user = await requireUser();
  const [context, posts, snapshot] = await Promise.all([
    getDashboardContext(user.id),
    listGooglePosts(user.id),
    getMapsPlace(user.id),
  ]);

  if (!context.isPhysical) notFound();

  const t = await getTranslations("dashboard.maps");
  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;
  const coherence = analysis.mapsCoherence ?? null;
  const place = snapshot?.place ?? null;

  // La fiche se tient semaine après semaine : réservée à l'abonnement.
  const locked = !canOpen(context.tier, "maps");
  const keyword = analysis.trendingKeywords?.keywords[0]?.keyword ?? null;

  const fetchedLabel = snapshot
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(snapshot.fetchedAt)
    : "";

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        subtitle={place?.address ?? context.mapsUrl}
        actions={
          locked || !context.mapsUrl ? undefined : (
            <SyncPlaceButton hasPlace={place !== null} stale={snapshot?.stale} />
          )
        }
      />

      <SectionGate section="maps" locked={locked}>
        {snapshot?.lastError ? (
          <p className="rounded-2xl bg-danger/5 px-4 py-3 text-sm text-danger">
            {t("syncFailed", { error: snapshot.lastError })}
          </p>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4">
            {place ? (
              <GooglePlacePanel place={place} fetchedLabel={fetchedLabel} />
            ) : (
              <MissingPlace hasUrl={Boolean(context.mapsUrl)} t={t} />
            )}
          </div>

          <div className="grid gap-4">
            {place ? <PlaceCompleteness place={place} /> : null}

            <Card>
              <CardTitle
                title={t("coherenceTitle")}
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
                  <p className="text-sm">{t("keywordLine", { keyword })}</p>
                  <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-sm">
                    {t("titleSuggestion", {
                      business: place?.title ?? analysis.businessName,
                      keyword,
                      city: place?.city ?? analysis.profile.location ?? context.cities[0] ?? "",
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

            {place ? <PlaceReviewWords place={place} /> : null}
            {place ? <PlacePopularTimes place={place} /> : null}
          </div>
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

/**
 * La place vide, à gauche, quand il n'y a pas encore de fiche à montrer.
 *
 * Deux causes, deux issues : aucun lien enregistré — on va le saisir dans les
 * réglages ; un lien mais aucun relevé — on relève, depuis le bouton en tête de
 * page. Rien n'est relevé automatiquement, chaque relevé se paie.
 */
function MissingPlace({
  hasUrl,
  t,
}: {
  hasUrl: boolean;
  t: (key: string) => string;
}) {
  return (
    <Card className="text-center">
      <p className="text-base font-semibold">
        {hasUrl ? t("place.notFetchedTitle") : t("place.noUrlTitle")}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {hasUrl ? t("place.notFetchedBody") : t("place.noUrlBody")}
      </p>
      {hasUrl ? null : (
        <Link
          href={ROUTES.dashboardSettings}
          className="mt-5 inline-flex rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
        >
          {t("place.goToSettings")}
        </Link>
      )}
    </Card>
  );
}
