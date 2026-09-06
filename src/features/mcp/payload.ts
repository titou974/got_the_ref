import "server-only";

import { getDashboardContext, listArticles } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildSolutionFacts, type ArticleFact } from "@/lib/geo/solution-facts";
import type { SolutionTab } from "@/lib/geo/solution-prompts";
import {
  FREE_RECOMMENDATION_LIMIT,
  SECTION_TIER,
  canOpen,
  offerForTier,
  seesRecommendation,
  type AccessTier,
  type DashboardSection,
} from "@/constants/access";
import { AGENT_CHARTER, CHARTER_REMINDER } from "./charter";

/**
 * Ce que l'agent appairé a le droit de lire : le statut du compte, puis les
 * correctifs que son offre ouvre.
 *
 * Le tri se fait ici, sur le serveur, à partir de la même table de droits que
 * la barre latérale et les actions du tableau de bord (`constants/access`). Un
 * agent est un client comme un autre : ce qui est fermé à l'écran l'est ici, et
 * pour la même raison. Un correctif fermé n'est pas flouté — il n'est pas servi
 * du tout, et l'agent n'en reçoit que le nom et l'offre qui l'ouvre.
 */

/** Les chantiers du produit, dans l'ordre où le client les lit. */
const CHANTIERS: { tab: Exclude<SolutionTab, "all">; section: DashboardSection; label: string }[] =
  [
    { tab: "results", section: "home", label: "Plan d'action" },
    { tab: "content", section: "content", label: "Contenu et citabilité" },
    { tab: "architecture", section: "architecture", label: "Architecture technique" },
    { tab: "articles", section: "articles", label: "Articles" },
    { tab: "presence", section: "presence", label: "Présence et notoriété" },
    { tab: "maps", section: "maps", label: "Fiche Google Maps" },
  ];

const TIER_LABELS: Record<AccessTier, string> = {
  free: "Compte gratuit",
  boost: "Coup de Boost",
  allin: "Abonnement Tout-en-un",
  demo: "Compte de démonstration",
};

const OFFER_LABELS = { boost: "Coup de Boost", allin: "Abonnement Tout-en-un" } as const;

export type McpStatus = {
  compte: {
    email: string;
    offre: AccessTier;
    offreLabel: string;
    /** Fin de la semaine de rédaction du Coup de Boost, si elle court encore. */
    redactionJusquau: string | null;
  };
  site: {
    domaine: string | null;
    url: string | null;
    nom: string;
    niche: string | null;
    villes: string[];
    plateforme: string | null;
  } | null;
  analyse: { id: string; note: number; date: string } | null;
  chantiers: { cle: string; libelle: string; ouvert: boolean; offreRequise: string | null }[];
};

export type McpFix = {
  /** L'onglet du tableau de bord d'où sort le correctif. */
  chantier: string;
  libelle: string;
  ouvert: boolean;
  /** L'offre à prendre pour l'ouvrir, quand il est fermé. */
  offreRequise: string | null;
  /**
   * La matière exacte à appliquer : textes, balises, fichiers, articles. Vide
   * quand le chantier est fermé — on n'envoie pas un contenu flouté, on
   * n'envoie rien.
   */
  dossier: string;
};

export type McpFixes = {
  site: McpStatus["site"];
  offre: { cle: AccessTier; label: string };
  correctifs: McpFix[];
  recommandations: {
    titre: string;
    description: string;
    priorite: string;
    categorie: string;
  }[];
  /** Correctifs prioritaires que l'offre ne couvre pas, nommés sans être servis. */
  fermes: { libelle: string; offreRequise: string }[];
  charte: string;
  rappel: string;
};

/** L'offre qui ouvre un chantier, en clair. */
function offerLabelFor(section: DashboardSection): string {
  return OFFER_LABELS[offerForTier(SECTION_TIER[section])];
}

/** Le statut du compte : ce que l'agent relève avant de toucher à quoi que ce soit. */
export async function buildStatus(userId: string, email: string): Promise<McpStatus> {
  const context = await getDashboardContext(userId);
  const analysis = context.analysis;

  return {
    compte: {
      email,
      offre: context.tier,
      offreLabel: TIER_LABELS[context.tier],
      redactionJusquau: context.boostArticlesUntil?.toISOString() ?? null,
    },
    site: analysis
      ? {
          domaine: context.domain ?? analysis.domain,
          url: analysis.url,
          nom: context.businessName || analysis.businessName,
          niche: context.niche,
          villes: context.cities,
          plateforme: analysis.signals.stack?.name ?? null,
        }
      : null,
    analyse: analysis
      ? {
          id: context.analysisId ?? "",
          note: analysis.overallScore,
          date: analysis.createdAt,
        }
      : null,
    chantiers: CHANTIERS.filter(
      // La fiche locale ne concerne qu'un commerce avec une adresse : l'annoncer
      // à un site sans pignon ferait travailler l'agent sur un manque inventé.
      ({ tab }) => tab !== "maps" || context.isPhysical || Boolean(context.mapsUrl),
    ).map(({ tab, section, label }) => {
      const ouvert = canOpen(context.tier, section);
      return {
        cle: tab,
        libelle: label,
        ouvert,
        offreRequise: ouvert ? null : offerLabelFor(section),
      };
    }),
  };
}

/**
 * Les correctifs, prêts à appliquer.
 *
 * Le dossier de chaque chantier est bâti par `buildSolutionFacts`, exactement
 * comme celui qui alimentait le prompt à copier. La matière ne change pas de
 * nature parce qu'elle passe par un agent : ce sont les mêmes textes, les mêmes
 * balises, les mêmes articles, à recopier mot pour mot.
 */
export async function buildFixes(userId: string): Promise<McpFixes | null> {
  const context = await getDashboardContext(userId);
  const analysis = context.analysis;
  if (!analysis) return null;

  const diagnostic = buildDiagnostic(analysis);
  const tier = context.tier;

  // Les articles ne se relisent que si le chantier est ouvert : un planning
  // complet pèse plusieurs dizaines de milliers de caractères, inutile de le
  // sortir de la base pour le jeter ensuite.
  const articles: ArticleFact[] = canOpen(tier, "articles")
    ? (await listArticles(userId)).map((article) => ({
        title: article.title,
        keyword: article.keyword,
        status: article.status,
        scheduledFor: article.scheduledFor,
        excerpt: article.excerpt,
        outline: article.outline,
        body: article.body,
      }))
    : [];

  const chantiers = CHANTIERS.filter(
    ({ tab }) => tab !== "maps" || context.isPhysical || Boolean(analysis.mapsUrl),
  );

  const correctifs: McpFix[] = chantiers.map(({ tab, section, label }) => {
    const ouvert = canOpen(tier, section);
    return {
      chantier: tab,
      libelle: label,
      ouvert,
      offreRequise: ouvert ? null : offerLabelFor(section),
      dossier: ouvert
        ? buildSolutionFacts({ tab, result: analysis, diagnostic, articles }).dossier
        : "",
    };
  });

  // Le plan d'action suit la même règle que sur l'accueil : les correctifs de
  // contenu se lisent en gratuit, bornés à quelques-uns ; le reste est nommé
  // mais pas détaillé.
  const ouvertes = analysis.recommendations.filter((r) => seesRecommendation(tier, r.category));
  const recommandations = (
    canOpen(tier, "architecture") ? ouvertes : ouvertes.slice(0, FREE_RECOMMENDATION_LIMIT)
  ).map((r) => ({
    titre: r.title,
    description: r.description,
    priorite: r.priority,
    categorie: r.category,
  }));

  return {
    site: {
      domaine: context.domain ?? analysis.domain,
      url: analysis.url,
      nom: context.businessName || analysis.businessName,
      niche: context.niche,
      villes: context.cities,
      plateforme: analysis.signals.stack?.name ?? null,
    },
    offre: { cle: tier, label: TIER_LABELS[tier] },
    correctifs,
    recommandations,
    fermes: correctifs
      .filter((c) => !c.ouvert)
      .map((c) => ({ libelle: c.libelle, offreRequise: c.offreRequise as string })),
    charte: AGENT_CHARTER,
    rappel: CHARTER_REMINDER,
  };
}
