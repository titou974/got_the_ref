import type { GeoAnalysisResult, Recommendation } from "./types";

/**
 * Ce que les corrections peuvent rapporter en visites, moteur par moteur.
 *
 * C'est une projection, pas une mesure, et tout ce fichier existe pour que ce
 * soit dit une fois plutôt que réinventé sur trois écrans. Les visites
 * réellement reçues, elles, se lisent ailleurs : la carte de trafic du tableau
 * de bord les relève dans Analytics une fois le compte rattaché. Ici, on
 * répond à la question posée avant : « si j'applique ça, combien ça me
 * ramène ? »
 *
 * Le modèle tient en trois facteurs :
 *
 *   1. Un plafond par moteur — les visites mensuelles qu'un commerce capte
 *      depuis chacun quand il est cité en tête sur sa niche. Les quatre
 *      surfaces ne pèsent pas pareil, et c'est la seule constante du calcul.
 *   2. La marge qui reste — un site déjà cité partout n'a rien à gagner. Elle
 *      se lit dans la note de visibilité : 100 ne laisse rien, 0 laisse tout.
 *   3. La part du chemin que couvrent les corrections dont on parle. L'onglet
 *      Contenu n'en corrige qu'une partie ; l'accueil les couvre toutes.
 *
 * Les valeurs sont arrondies au multiple de cinq, et le total est la somme des
 * valeurs arrondies, pas l'arrondi de la somme. Une carte qui annonce un total
 * que ses quatre parts ne reconstituent pas se fait relire une fois, et plus
 * jamais croire. Chaque moteur porte un plancher (`FLOOR_PER_ENGINE`) : le
 * total ne tombe donc jamais à zéro.
 */

/** Les quatre surfaces qui envoient des visites, dans l'ordre de leur poids. */
export const GAIN_ENGINES = ["google", "chatgpt", "gemini", "perplexity"] as const;

export type GainEngine = (typeof GAIN_ENGINES)[number];

/**
 * Le plafond mensuel par moteur, pour un commerce de taille courante cité en
 * tête sur sa niche.
 *
 * L'écart entre les quatre est volontairement large, parce qu'il l'est dans les
 * faits. Google et ChatGPT ramènent l'essentiel : le premier pose ses aperçus
 * IA au-dessus de résultats déjà fréquentés, et c'est la seule des quatre
 * surfaces qu'un client atteint sans avoir choisi d'ouvrir un assistant ; le
 * second a l'audience propre la plus large du lot. Gemini tient le milieu,
 * porté par sa place dans les produits Google mais interrogé bien moins souvent
 * en recherche. Perplexity ferme la marche loin derrière : ses réponses citent
 * leurs sources plus volontiers qu'ailleurs, mais son audience française reste
 * une fraction des trois autres.
 */
const CEILING: Record<GainEngine, number> = {
  google: 220,
  chatgpt: 180,
  gemini: 60,
  perplexity: 15,
};

/** Les libellés affichés, et le logo qui va avec (chemins dans /public). */
export const GAIN_ENGINE_META: Record<GainEngine, { label: string; logo: string }> = {
  google: { label: "Google", logo: "/google.svg" },
  chatgpt: { label: "ChatGPT", logo: "/chatgpt.png" },
  gemini: { label: "Gemini", logo: "/gemini.webp" },
  perplexity: { label: "Perplexity", logo: "/perplexity.png" },
};

/**
 * La part du chemin couverte par les seules corrections de contenu, quand
 * l'analyse ne permet pas de la calculer.
 *
 * Le contenu — titre, description, H1, introduction, profondeur éditoriale —
 * pèse un peu plus du tiers du travail. Le reste est structure, données
 * structurées, présence hors-site.
 */
const CONTENT_SHARE_FALLBACK = 0.38;

/** Les familles de correctifs qui relèvent du contenu (cf. `CategoryKey`). */
const CONTENT_CATEGORIES = ["contentEEAT"] as const;

export type EngineGain = {
  engine: GainEngine;
  label: string;
  logo: string;
  /** Visites mensuelles supplémentaires estimées sur ce moteur. */
  visits: number;
};

export type TrafficGain = {
  engines: EngineGain[];
  /** Somme des quatre moteurs — donc exactement ce que les cartes affichent. */
  total: number;
};

/**
 * Le plancher par moteur, en visites mensuelles.
 *
 * Aucune carte ne descend à zéro, et le total non plus. Un site n'est jamais
 * si bien placé qu'il n'ait plus rien à prendre : les quatre moteurs
 * réinterrogent leur index en continu, les concurrents bougent, et une note de
 * 100 sur notre échelle veut dire « rien à corriger aujourd'hui », pas « plus
 * une visite à gagner ». Annoncer zéro dirait le contraire, et le dirait faux.
 */
const FLOOR_PER_ENGINE = 5;

/** Arrondi au multiple de cinq : un chiffre estimé ne se donne pas à l'unité. */
function roundToFive(value: number): number {
  return Math.max(FLOOR_PER_ENGINE, Math.round(value / 5) * 5);
}

/**
 * Le gain estimé, à partir d'une note de visibilité et de la part du travail
 * couverte.
 *
 * @param score    Note de visibilité actuelle, de 0 à 100.
 * @param coverage Part du chemin que couvrent les corrections en question, de
 *                 0 à 1. Un pour « toutes les corrections ».
 */
export function estimateTrafficGain(score: number, coverage = 1): TrafficGain {
  const headroom = Math.min(1, Math.max(0, 1 - score / 100));
  const factor = headroom * Math.min(1, Math.max(0, coverage));

  const visits = GAIN_ENGINES.map((engine) => roundToFive(CEILING[engine] * factor));
  const total = visits.reduce((sum, value) => sum + value, 0);

  return {
    total,
    engines: GAIN_ENGINES.map((engine, index) => ({
      engine,
      label: GAIN_ENGINE_META[engine].label,
      logo: GAIN_ENGINE_META[engine].logo,
      visits: visits[index],
    })),
  };
}

/**
 * La part du travail que portent les corrections de contenu, lue sur l'analyse.
 *
 * Elle se calcule sur l'impact déclaré des correctifs plutôt que sur leur
 * nombre : trois retouches de balises ne valent pas trois refontes de page, et
 * le champ `impact` est précisément là pour le dire. Sans correctif relevé, on
 * retombe sur la part de référence.
 */
export function contentCoverage(recommendations: Recommendation[]): number {
  const total = recommendations.reduce((sum, r) => sum + r.impact, 0);
  if (total <= 0) return CONTENT_SHARE_FALLBACK;

  const content = recommendations
    .filter((r) => (CONTENT_CATEGORIES as readonly string[]).includes(r.category))
    .reduce((sum, r) => sum + r.impact, 0);

  if (content <= 0) return CONTENT_SHARE_FALLBACK;
  return content / total;
}

/** Le gain de toutes les corrections d'une analyse. */
export function totalGainFor(analysis: GeoAnalysisResult): TrafficGain {
  return estimateTrafficGain(analysis.overallScore);
}

/** Le gain des seules corrections de contenu d'une analyse. */
export function contentGainFor(analysis: GeoAnalysisResult): TrafficGain {
  return estimateTrafficGain(analysis.overallScore, contentCoverage(analysis.recommendations));
}
