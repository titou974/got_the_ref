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
import { Card, CardTitle, PageHeader, StatusDot } from "@/components/tableau-de-bord/Card";
import { GooglePostPlanner } from "@/components/tableau-de-bord/GooglePostPlanner";
import { AttributeRows } from "@/components/tableau-de-bord/maps/AttributeRows";
import { GooglePlacePanel } from "@/components/tableau-de-bord/maps/GooglePlacePanel";
import { ListingCompare } from "@/components/tableau-de-bord/maps/ListingCompare";
import { MapsGate } from "@/components/tableau-de-bord/maps/MapsGate";
import { MAPS_ANCHORS, boxCount, buildMapsTasks } from "@/components/tableau-de-bord/maps/maps-priorities";
import {
  PlaceCompleteness,
  PlacePopularTimes,
  PlaceReviewWords,
} from "@/components/tableau-de-bord/maps/PlaceInsights";
import { PlaceMiniCard } from "@/components/tableau-de-bord/maps/PlaceMiniCard";
import { ReviewFocus } from "@/components/tableau-de-bord/maps/ReviewFocus";
import { CoherenceNote, TextsNote } from "@/components/tableau-de-bord/maps/SidebarNotes";
import { SyncPlaceButton } from "@/components/tableau-de-bord/maps/SyncPlaceButton";
import { WeekTasks } from "@/components/tableau-de-bord/maps/WeekTasks";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Google Maps : ce qu'il y a à faire sur la fiche cette semaine.
 *
 * L'écran ouvrait sur la fiche relevée chez Google — le commerçant la
 * reconnaissait, puis descendait six cartes pour trouver le geste à faire.
 * L'ordre est inversé : la page ouvre sur trois gestes datés, classés par ce
 * qu'ils rapportent, et chacun mène à la carte qui le porte. La fiche passe en
 * carte compacte à droite, assez pour servir de repère ; le panneau complet, les
 * textes, les cases et les mesures se rangent dessous, dans le même ordre que
 * l'échelle.
 *
 * Deux gestes gardent leur carte en haut, parce qu'ils se font ici et nulle part
 * ailleurs : la réponse aux avis, un avis à la fois, et le rythme de posts.
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

  /** Le rang d'un geste dans l'échelle : la carte le reprend en tête. */
  const rankOf = (id: string) => {
    const index = tasks.findIndex((task) => task.id === id);
    return index === -1 ? null : index + 1;
  };

  const boxes = boxCount(attributes);

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

        <MapsGate
          hasUrl={Boolean(context.mapsUrl)}
          hasPlace={place !== null}
          locked={locked}
        >
          {place ? (
            <div className="space-y-6">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                  <WeekTasks tasks={tasks} checked={boxes.checked} total={boxes.total} />

                  <ReviewFocus
                    place={place}
                    rank={rankOf("reviews")}
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

                  <GooglePostPlanner
                    posts={postRows}
                    businessName={place.title}
                    rank={rankOf("posts")}
                  />
                </div>

                <div className="space-y-4 lg:sticky lg:top-4">
                  <PlaceMiniCard place={place} fetchedLabel={fetchedLabel} />
                  <SyncPlaceButton hasPlace stale={snapshot?.stale} block />
                  <CoherenceNote
                    matches={coherence?.matches ?? []}
                    summary={coherence?.summary ?? null}
                  />
                  <TextsNote place={place} advice={advice} />
                </div>
              </div>

              {/* Le reste de la fiche, rangé dessous, dans l'ordre de l'échelle :
                  les textes, les cases, puis ce qui se mesure sans se corriger. */}
              <div className="flex items-center gap-3 pt-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-steel">
                  Le détail de la fiche
                </h2>
                <span aria-hidden className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-4">
                <div id={MAPS_ANCHORS.texts} className="scroll-mt-6">
                  <ListingCompare place={place} advice={advice} />
                </div>

                <div id={MAPS_ANCHORS.attributes} className="scroll-mt-6">
                  <AttributeRows groups={attributes} />
                </div>

                <PlaceCompleteness place={place} />

                <Card id={MAPS_ANCHORS.coherence} className="scroll-mt-6">
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
                        <li
                          key={match.label}
                          className="flex items-center justify-between gap-3 py-3"
                        >
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

                <PlaceReviewWords place={place} />
                <PlacePopularTimes place={place} />

                {/* La fiche entière, telle que Google la montre. Elle n'ouvre
                    plus la page — le commerçant la connaît — mais elle reste à
                    portée : c'est là qu'il vérifie ce qu'un client voit. */}
                <details className="group rounded-card-compact border border-border bg-surface p-5 sm:p-6">
                  <summary className="cursor-pointer list-none">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">
                          Votre fiche telle que Google la montre
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">
                          Relevée le {fetchedFull}. Photos, horaires, avis et attributs compris.
                        </span>
                      </span>
                      <span className="shrink-0 rounded-pill border border-border px-3.5 py-1.5 text-[13px] font-medium">
                        <span className="group-open:hidden">Ouvrir</span>
                        <span className="hidden group-open:inline">Replier</span>
                      </span>
                    </span>
                  </summary>

                  <div className="mt-5 max-w-[400px]">
                    <GooglePlacePanel place={place} fetchedLabel={fetchedFull} />
                  </div>
                </details>
              </div>
            </div>
          ) : null}
        </MapsGate>
      </SectionGate>
    </>
  );
}
