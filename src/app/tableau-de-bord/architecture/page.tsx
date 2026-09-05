import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { businessHint, getDashboardContext } from "@/features/dashboard/queries";
import { buildSiteTree } from "@/lib/geo/site-tree";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SiteSkeleton } from "@/components/geo/SiteSkeleton";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { StructureIntroModal } from "@/components/tableau-de-bord/StructureIntroModal";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Architecture : le squelette du site, et rien d'autre.
 *
 * L'écran rejouait l'onglet Architecture du rapport d'analyse — même anneau,
 * même radar, mêmes contrôles. C'était juste tant que la page n'avait rien à
 * proposer : un rapport se lit, et deux copies d'un même rapport valent mieux
 * qu'un second verdict divergent.
 *
 * Elle s'en écarte maintenant, sur un point qui change sa nature. Le rapport
 * constate ; le tableau de bord corrige. La carte du squelette tient donc seule
 * l'écran : elle montre les adresses que les moteurs de réponse vont chercher à
 * la racine, marque celles qui manquent à leur place dans l'arbre, tient le
 * contenu déjà rédigé pour chacune, et porte le bouton qui les dépose. C'est le
 * livrable du Coup de Boost, resté jusqu'ici sans porte d'entrée : l'action
 * serveur existait, aucun écran ne l'appelait.
 *
 * Tout le reste — l'anneau de note, les trois axes du modèle, la grille des
 * contrôles techniques, l'accès des robots d'IA, le relevé du passage — a
 * quitté l'écran. C'était le rapport recopié : du constat, là où le client
 * vient poser des fichiers. Il se lit à sa place, dans le rapport d'analyse.
 *
 * La grille du contenu éditorial est passée, elle, à l'écran Contenu, où sa
 * note se calcule.
 */
export default async function ArchitecturePage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.architecture");
  const ta = await getTranslations("analysisReport");

  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;
  const tree = buildSiteTree(analysis);

  // La page entière passe sous voile quand l'offre ne l'ouvre pas : le client
  // voit la forme du squelette sans qu'aucune de ses valeurs ne soit rendue, et
  // l'appel le mène aux tarifs (cf. `SectionGate`).
  const locked = !canOpen(context.tier, "architecture");

  // Le dépôt demande un rattachement vivant ET un connecteur qui sait écrire :
  // l'action le revérifie côté serveur, le bouton ne fait qu'éviter au client
  // un clic dont il connaîtrait déjà l'échec.
  const canApply =
    context.site?.status === "connected" && context.site.capabilities.includes("edit");

  return (
    <>
      <PageHeader title={t("pageTitle")} subtitle={ta("architecture.subtitle")} />

      {/* Ce que l'écran fait, une seule fois, pour les offres qui l'ouvrent. Sous
          voile, l'arborescence n'a aucune valeur à montrer : l'expliquer ne
          servirait qu'à vendre. */}
      {locked ? null : <StructureIntroModal domain={analysis.signals.domain} />}

      <SectionGate section="architecture" locked={locked}>
        <SiteSkeleton
          tree={tree}
          stack={analysis.signals.stack ?? null}
          pagesCrawled={analysis.signals.crawl.pagesCrawled}
          canApply={canApply}
        />
      </SectionGate>
    </>
  );
}
