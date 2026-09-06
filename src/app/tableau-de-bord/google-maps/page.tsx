import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  businessHint,
  getDashboardContext,
  getMapsAdvice,
  getMapsPlace,
  listGooglePosts,
  listReviewReplies,
} from "@/features/dashboard/queries";
import { auditAttributes } from "@/features/dashboard/maps-service";
import { CardTitle, PageHeader, StatusDot } from "@/components/tableau-de-bord/Card";
import { GooglePostPlanner } from "@/components/tableau-de-bord/GooglePostPlanner";
import { AttributeRows } from "@/components/tableau-de-bord/maps/AttributeRows";
import { GooglePlacePanel } from "@/components/tableau-de-bord/maps/GooglePlacePanel";
import { ListingCompare } from "@/components/tableau-de-bord/maps/ListingCompare";
import { MapsGate } from "@/components/tableau-de-bord/maps/MapsGate";
import { boxCount, buildMapsTasks, type MapsTaskId } from "@/components/tableau-de-bord/maps/maps-priorities";
import {
  PlaceCompleteness,
  PlacePopularTimes,
  PlaceReviewWords,
} from "@/components/tableau-de-bord/maps/PlaceInsights";
import { PlaceMiniCard } from "@/components/tableau-de-bord/maps/PlaceMiniCard";
import { ReviewFocus } from "@/components/tableau-de-bord/maps/ReviewFocus";
import { CoherenceNote, TextsNote } from "@/components/tableau-de-bord/maps/SidebarNotes";
import { SyncPlaceButton } from "@/components/tableau-de-bord/maps/SyncPlaceButton";
import { WeekPlan } from "@/components/tableau-de-bord/maps/WeekPlan";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Google Maps : la liste des chantiers de la fiche, et rien d'autre.
 *
 * L'écran ouvrait sur la fiche relevée chez Google — le commerçant la
 * reconnaissait, puis descendait six cartes pour trouver le geste à faire. La
 * page n'est plus qu'une liste de chantiers, un par problème relevé : le nom,
 * la description, la présentation, les cases, les champs vides, l'écart avec le
 * site. Chacun s'ouvre là où on a cliqué, la correction dedans.
 *
 * Deux gardent leur carte plus bas, parce que ce sont des ateliers et non des
 * corrections : les avis, un à la fois, et le rythme de posts. On y revient
 * dans la semaine ; un tiroir qu'on rouvre dix fois n'est plus un tiroir.
 *
 * La fiche elle-même passe en carte compacte à droite, et le panneau Google
 * complet se replie en fin de page avec les deux relevés qui ne se corrigent
 * pas — les mots des avis, l'affluence.
 *
 * Section réservée aux commerces qui ont une adresse : un site sans
 * établissement n'a pas de fiche à tenir.
 */
export default async function GoogleMapsPage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);

  if (!context.isPhysical) notFound();

  const [posts, snapshot, replies] = await Promise.all([
    listGooglePosts(user.id),
    getMapsPlace(user.id),
    listReviewReplies(user.id),
  ]);

  const t = await getTranslations("dashboard.maps");
  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;
  const coherence = analysis.mapsCoherence ?? null;
  const place = snapshot?.place ?? null;
  const advice = place ? await getMapsAdvice(user.id, place.placeId) : null;

  // La fiche se tient semaine après semaine : réservée à l'abonnement.
  const locked = !canOpen(context.tier, "maps");

  // Tant qu'aucune proposition n'a été demandée, l'audit déterministe suffit à
  // montrer les cases vides : il ne dit pas encore lesquelles cocher, mais il
  // dit déjà combien il en manque.
  const attributes = advice?.attributes ?? (place ? auditAttributes(place) : []);

  // Les avis qui attendent : ni réponse du commerce sur la fiche, ni réponse
  // déjà rédigée ici.
  const drafted = new Set(replies.map((row) => row.reviewId));
  const pendingReviews = (place?.reviews ?? []).filter(
    (review) => review.ownerResponse === null && !drafted.has(review.id),
  ).length;
  const draftedReplies = replies.filter((row) => row.status !== "approved").length;

  const postRows = posts.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
    cta: post.cta,
    keyword: post.keyword,
    status: post.status,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    imageUrl: post.imageUrl,
  }));

  const tasks = place
    ? buildMapsTasks({
        place,
        advice,
        attributes,
        pendingReviews,
        draftedReplies,
        posts: postRows,
        coherenceMismatches: (coherence?.matches ?? []).filter((match) => !match.consistent).length,
      })
    : [];

  const boxes = boxCount(attributes);

  // La correction de chaque chantier, rendue ici et remise à la liste : elle
  // s'affiche dans le tiroir, sans son cadre — elle est déjà dans une carte.
  const panels: Partial<Record<MapsTaskId, React.ReactNode>> = place
    ? {
        name: <ListingCompare place={place} advice={advice} only="title" bare />,
        description: <ListingCompare place={place} advice={advice} only="description" bare />,
        about: <ListingCompare place={place} advice={advice} only="about" bare />,
        attributes: <AttributeRows groups={attributes} bare />,
        fields: <PlaceCompleteness place={place} bare />,
        coherence: coherence ? (
          <>
            <CardTitle title={t("coherenceTitle")} hint={coherence.summary} />
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
        ) : null,
      }
    : {};

  const fetchedLabel = snapshot
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      }).format(snapshot.fetchedAt)
    : "";

  const fetchedFull = snapshot
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(snapshot.fetchedAt)
    : "";

  return (
    <>
      <PageHeader title={t("pageTitle")} subtitle={place?.address ?? context.mapsUrl} />

      <SectionGate section="maps" locked={locked}>
        {snapshot?.lastError ? (
          <p className="rounded-2xl bg-danger/5 px-4 py-3 text-sm text-danger">
            {t("syncFailed", { error: snapshot.lastError })}
          </p>
        ) : null}

        <MapsGate hasUrl={Boolean(context.mapsUrl)} hasPlace={place !== null} locked={locked}>
          {place ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <WeekPlan
                  tasks={tasks}
                  checked={boxes.checked}
                  total={boxes.total}
                  panels={panels}
                />

                <ReviewFocus
                  place={place}
                  rows={replies.map((row) => ({
                    id: row.id,
                    reviewId: row.reviewId,
                    reviewerName: row.reviewerName,
                    stars: row.stars,
                    reviewText: row.reviewText,
                    reply: row.reply,
                    status: row.status,
                  }))}
                />

                <GooglePostPlanner posts={postRows} businessName={place.title} />

                {/* Ce qui se regarde sans se corriger : la fiche entière telle
                    que Google la montre, les mots que les clients répètent, le
                    rythme de la semaine. Replié, parce qu'aucun de ces trois
                    relevés n'appelle un geste. */}
                <details className="group rounded-card-compact border border-border bg-surface p-5 sm:p-6">
                  <summary className="cursor-pointer list-none">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">
                          Votre fiche telle que Google la montre
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">
                          Relevée le {fetchedFull}. Photos, avis, mots des clients et affluence.
                        </span>
                      </span>
                      <span className="shrink-0 rounded-pill border border-border px-3.5 py-1.5 text-[13px] font-medium">
                        <span className="group-open:hidden">Ouvrir</span>
                        <span className="hidden group-open:inline">Replier</span>
                      </span>
                    </span>
                  </summary>

                  <div className="mt-5 space-y-4">
                    <div className="max-w-[400px]">
                      <GooglePlacePanel place={place} fetchedLabel={fetchedFull} />
                    </div>
                    <PlaceReviewWords place={place} />
                    <PlacePopularTimes place={place} />
                  </div>
                </details>
              </div>

              <div className="space-y-4 lg:sticky lg:top-4">
                <PlaceMiniCard place={place} fetchedLabel={fetchedLabel} />
                <SyncPlaceButton hasPlace stale={snapshot?.stale} block />
                <CoherenceNote matches={coherence?.matches ?? []} />
                <TextsNote place={place} advice={advice} />
              </div>
            </div>
          ) : null}
        </MapsGate>
      </SectionGate>
    </>
  );
}
