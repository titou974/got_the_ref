import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  businessHint,
  getDashboardContext,
  getMapsPlace,
  getOnPageRewriteQuota,
  getSiteHours,
} from "@/features/dashboard/queries";
import { contentGainFor } from "@/lib/geo/traffic-gain";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ContentCompare } from "@/components/tableau-de-bord/ContentCompare";
import { KeywordTable } from "@/components/tableau-de-bord/KeywordTable";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SiteHoursCard } from "@/components/tableau-de-bord/SiteHoursCard";
import { TrafficGainCards } from "@/components/geo/TrafficGainCards";

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
 */
export default async function ContenuPage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const [quota, hours, listing, t, tg] = await Promise.all([
    getOnPageRewriteQuota(user.id),
    getSiteHours(user.id, context.domain),
    getMapsPlace(user.id),
    getTranslations("dashboard.content"),
    getTranslations("trafficGain"),
  ]);

  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;

  return (
    <>
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

      <KeywordTable insight={analysis.trendingKeywords ?? null} />
    </>
  );
}
