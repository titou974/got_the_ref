import type { GeoAnalysisResult } from "./types";
import type { AnalysisDiagnostic, DiagnosticCheck } from "./diagnostic";

/**
 * Génère, à partir des constats réels de l'analyse, un prompt prêt à coller
 * dans Claude (ou un agent IA) pour corriger les points faibles d'un onglet
 * donné. Pur et déterministe : un prompt est toujours disponible, sans appel
 * IA supplémentaire, et reste fidèle à ce qui a réellement été détecté.
 *
 * Libellés en français en dur (produit mono-locale) — alignés sur les libellés
 * affichés dans l'UI.
 */

export type SolutionTab = "results" | "architecture" | "content" | "presence" | "maps";

const ARCH_LABELS: Record<string, string> = {
  llmsTxt: "Fichier llms.txt",
  schema: "Données structurées Schema.org (JSON-LD)",
  h1: "Titre H1 unique",
  title: "Balise <title>",
  metaDescription: "Méta description",
  firstParagraph: "Paragraphe d'introduction citable",
  aiCrawlers: "Accès des robots d'IA",
  https: "HTTPS",
};

const CONTENT_LABELS: Record<string, string> = {
  faq: "FAQ structurée",
  editorialQuality: "Qualité éditoriale (E-E-A-T)",
  citability: "Citabilité par les IA",
  wordCount: "Volume de contenu",
  mapsReviews: "Avis Google Maps",
  mapsCoherence: "Cohérence fiche Maps ↔ site",
};

function issues(checks: DiagnosticCheck[], labels: Record<string, string>): string[] {
  return checks
    .filter((c) => c.status === "ko" || c.status === "warn")
    .map(
      (c) =>
        `- ${labels[c.key] ?? c.key}${c.status === "ko" ? " (manquant)" : " (à améliorer)"}`,
    );
}

function header(result: GeoAnalysisResult): string {
  const loc = result.profile.location ? ` à ${result.profile.location}` : "";
  return `Tu es un expert GEO (Generative Engine Optimization). Voici le diagnostic de visibilité IA de mon site ${result.domain} — ${result.profile.niche}${loc}.`;
}

export function buildSolutionPrompt(
  tab: SolutionTab,
  result: GeoAnalysisResult,
  diagnostic: AnalysisDiagnostic,
): string {
  const h = header(result);

  switch (tab) {
    case "architecture": {
      const list = issues(diagnostic.architecture.checks, ARCH_LABELS);
      return `${h}

Mon architecture technique présente ces points à corriger :
${list.length ? list.join("\n") : "- (aucun point bloquant détecté, vise l'excellence)"}

Pour chacun, donne-moi le code exact prêt à coller : balises HTML, JSON-LD Schema.org complet adapté à mon activité, contenu du fichier /llms.txt et directives robots.txt autorisant les crawlers d'IA. Explique où placer chaque élément.`;
    }

    case "content": {
      const list = issues(diagnostic.content.checks, CONTENT_LABELS);
      return `${h}

Côté contenu, voici ce qui limite ma citabilité par les IA :
${list.length ? list.join("\n") : "- (contenu globalement solide, renforce la profondeur)"}

Rédige les améliorations prêtes à publier : 3 passages auto-portants de 40 à 160 mots répondant aux questions clés de mon audience (avec des faits et chiffres précis), une FAQ structurée (questions + réponses), et des signaux E-E-A-T (bio d'auteur, sources citées).`;
    }

    case "presence": {
      const quals = result.webPresence.qualifications
        .map((q) => `- ${q.label} (${q.source})`)
        .join("\n");
      return `${h}

Ma notoriété éditoriale actuelle :
${quals || "- Aucune qualification ni mention presse notable détectée."}

Établis un plan de notoriété sur 90 jours pour mon secteur : quels guides et labels viser (et comment candidater), quels médias et blogs pitcher, quels formats de contenu produire pour être cité par les IA. Donne une liste d'actions priorisées et un modèle d'e-mail de prise de contact presse.`;
    }

    case "maps": {
      const inconsistencies = (result.mapsCoherence?.matches ?? [])
        .filter((m) => !m.consistent)
        .map((m) => `- ${m.label} : ${m.detail}`);
      return `${h}

${
        result.mapsUrl
          ? `Ma fiche Google Maps : ${result.mapsUrl}`
          : "Je n'ai pas encore renseigné ma fiche Google Maps."
      }
Incohérences détectées entre la fiche et le site :
${inconsistencies.length ? inconsistencies.join("\n") : "- (à vérifier : nom, adresse, téléphone, catégorie, horaires)"}

Donne-moi un plan pour aligner parfaitement ma fiche Google Maps et mon site : NAP identique, catégorie principale, description optimisée, photos, et stratégie d'avis — afin de renforcer ma cohérence locale aux yeux des IA.`;
    }

    case "results":
    default: {
      const recos = result.recommendations
        .slice(0, 6)
        .map((r) => `- [${r.priority}] ${r.title} : ${r.description}`);
      return `${h}

Score GEO global : ${result.overallScore}/100. Recommandations prioritaires :
${recos.join("\n") || "- (aucune recommandation majeure)"}

Construis-moi un plan d'action GEO priorisé pour passer ces recommandations en production : pour chaque point, l'objectif, les étapes concrètes et le code ou contenu exact à mettre en place. Commence par ce qui a le plus d'impact.`;
    }
  }
}
