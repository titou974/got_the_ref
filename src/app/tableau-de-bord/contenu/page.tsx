import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  businessHint,
  getDashboardContext,
  getMapsPlace,
  getOnPageRewriteQuota,
  getSiteHours,
} from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { contentGainFor } from "@/lib/geo/traffic-gain";
import { CardTitle, PageHeader } from "@/components/tableau-de-bord/Card";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { DiagnosticGrid } from "@/components/geo/DiagnosticGrid";
import { ContentCompare } from "@/components/tableau-de-bord/ContentCompare";
import { ContentIntroModal } from "@/components/tableau-de-bord/ContentIntroModal";
import { KeywordTable } from "@/components/tableau-de-bord/KeywordTable";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SiteHoursCard } from "@/components/tableau-de-bord/SiteHoursCard";
import { TrafficGainCards } from "@/components/geo/TrafficGainCards";
import { tierAtLeast } from "@/constants/access";

export const maxDuration = 300;

/**
 * Contenu : ce que la page rapporte, ce qu'elle corrige, et les mots sur
 * lesquels elle le fait.
 *
 * L'ordre a changé. Le tableau des mots-clés ouvrait l'écran : c'était de la
 * documentation avant l'action, et le client devait descendre pour trouver ce
 * qu'on lui demande de faire. Il ferme désormais la page — on le consulte
 * quand on veut vérifier un terme, pas pour décider.
 *
 * En tête, la raison d'agir : les visites que ces corrections peuvent ramener,
 * réparties sur les quatre surfaces qui les envoient. Puis les trois endroits
 * où les mots s'écrivent — la balise title et la meta description, le H1, le
 * paragraphe d'introduction — l'existant et la réécriture côte à côte.
 *
 * La grille du contenu éditorial — FAQ, avis, notation éditoriale, citabilité,
 * volume, cohérence Maps — vient de l'écran Architecture, où elle était rendue
 * sous les contrôles techniques. Sa note n'a jamais pesé dans l'anneau
 * d'architecture, qui ne compte que le technique et les données structurées :
 * elle appartient à la note contenu, donc à cet écran. Elle se pose juste
 * au-dessus du tableau des mots-clés, dernier arrêt avant la documentation.
 */
export default async function ContenuPage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const [quota, hours, listing, t, tg, ta] = await Promise.all([
    getOnPageRewriteQuota(user.id),
    getSiteHours(user.id, context.domain),
    getMapsPlace(user.id),
    getTranslations("dashboard.content"),
    getTranslations("trafficGain"),
    getTranslations("analysisReport"),
  ]);

  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;
  const content = buildDiagnostic(analysis).content;
  const passing = content.checks.filter((c) => c.status === "ok").length;
  const pending = content.checks.length - passing;

  // Les fenêtres d'explication ne s'ouvrent que sur une offre payée, comme
  // celles de l'architecture et des articles : le Coup de Boost, l'abonnement,
  // et le compte de démonstration qui les suit.
  const explained = tierAtLeast(context.tier, "boost");

  return (
    <>
      {/* L'explication de l'écran, une seule fois, pour les offres payées. Elle
          vient après le garde d'analyse : tant que le rapport se prépare, il n'y
          a pas de textes à commenter.

          Un compte gratuit ne la voit pas. La page lui est pourtant ouverte,
          mais son troisième temps ne parle que de faire poser les corrections
          par les agents, et c'est justement ce qu'il n'a pas payé : la fenêtre
          lui vendrait l'écran au lieu de l'expliquer. */}
      {explained ? <ContentIntroModal domain={analysis.domain} /> : null}

      <PageHeader title={t("pageTitle")} />

      {/* Le gain n'est compté que sur la part contenu du plan d'action : cette
          page ne corrige pas la structure, et lui attribuer le total ferait
          promettre deux fois le même chiffre à deux écrans. */}
      <TrafficGainCards
        gain={contentGainFor(analysis)}
        title={tg("contentTitle")}
        caption={tg("contentCaption")}
      />

      <ContentCompare
        current={{
          title: analysis.signals.title,
          metaDescription: analysis.signals.metaDescription,
          h1: analysis.signals.h1[0] ?? null,
          intro: analysis.signals.firstParagraph,
          url: analysis.url,
          domain: analysis.domain,
        }}
        insight={analysis.trendingKeywords ?? null}
        quota={quota}
      />

      {/* Les horaires ne concernent que les commerces qui ont une adresse : un
          site sans établissement n'a pas d'heure d'ouverture à recouper. */}
      {context.isPhysical ? (
        <SiteHoursCard check={hours?.check ?? null} hasListing={listing !== null} />
      ) : null}

      <AnimatedCard className="mt-4">
        <CardTitle
          title={ta("content.title")}
          hint={ta("content.subtitle")}
          action={
            <span className="rounded-pill bg-mist px-3 py-1 text-[11px] font-semibold text-slate">
              {t("checksSummary", { passing, pending })}
            </span>
          }
        />
        <DiagnosticGrid section={content} labelNs="content" issuesFirst />
      </AnimatedCard>

      <KeywordTable insight={analysis.trendingKeywords ?? null} />
    </>
  );
}
