import "server-only";

import { z } from "zod";
import { askJson } from "@/lib/ai/client";
import { askGeminiGrounded } from "@/lib/ai/gemini";
import { buildCorpus, getOrCrawlSite, saveSiteAnalysis } from "@/lib/crawl/store";
import { crawlSite } from "@/lib/crawl/firecrawl";
import { hasPhysicalPresence } from "./steps";

/**
 * Les appels au modèle qui nourrissent l'accueil client.
 *
 * Un principe tient tout le fichier : une étape = un appel. Le tunnel se
 * traverse en quelques minutes, chaque aller-retour se voit, et le coût par
 * client doit rester de l'ordre du centime — d'où DeepSeek V4 Flash en tête et
 * des sorties JSON courtes plutôt que des dissertations à retailler ensuite.
 *
 * Une exception : les concurrents. Les nommer suppose de savoir qui existe
 * aujourd'hui, à cette adresse et dans cette ville — une question d'index, pas
 * de mémoire. Cette étape part donc sur Gemini avec la recherche Google, et ne
 * retombe sur DeepSeek que si l'appel n'aboutit pas.
 */

const SYSTEM = [
  "Tu es analyste au sein d'une agence d'optimisation pour les moteurs de réponse (GEO).",
  "Tu réponds exclusivement en JSON valide, sans texte autour, sans bloc de code.",
  "Tu n'inventes jamais un fait absent des éléments fournis : un champ inconnu vaut null ou une liste vide.",
].join(" ");

// ── Étape 2 : lecture du site ────────────────────────────────────────────────

const siteAnalysisSchema = z.object({
  language: z.string().nullable().catch(null),
  country: z.string().nullable().catch(null),
  cities: z.array(z.string()).max(20).catch([]),
  businessName: z.string().nullable().catch(null),
  summary: z.string().nullable().catch(null),
  suggestedNiche: z.string().nullable().catch(null),
  suggestedAudience: z.string().nullable().catch(null),
});

export type SiteAnalysis = z.infer<typeof siteAnalysisSchema> & {
  /** Nombre de pages effectivement conservées en base pour ce site. */
  pageCount: number;
};

/**
 * Crawle le site, conserve chaque page en base, puis en tire la langue, le pays
 * et les villes.
 *
 * Les villes ne sont cherchées que pour un commerce qui reçoit du public :
 * demander ses villes à une boutique en ligne revient à lui faire confirmer une
 * information qui n'existe pas, et le modèle finirait par en inventer une.
 */
export async function analyzeSite({
  url,
  businessKind,
  mapsUrl,
}: {
  url: string;
  businessKind: string | null;
  mapsUrl?: string | null;
}): Promise<SiteAnalysis> {
  const site = await getOrCrawlSite(url, { maxPages: 25, maxDepth: 2 });
  const corpus = buildCorpus(site.pages);
  const physical = hasPhysicalPresence(businessKind);

  const analysis = await askJson(siteAnalysisSchema, {
    system: SYSTEM,
    prompt: [
      `Voici le contenu crawlé du site ${site.url} (${site.pages.length} pages).`,
      mapsUrl ? `Fiche Google Maps déclarée : ${mapsUrl}` : "",
      "",
      corpus.slice(0, 60_000),
      "",
      "Réponds en JSON avec exactement ces clés :",
      '- "language" : code de la langue principale du site (ex. "fr", "en").',
      '- "country" : code pays ISO 3166-1 alpha-2 du marché principal (ex. "FR"), sinon null.',
      physical
        ? '- "cities" : les villes où ce commerce reçoit réellement du public, telles qu\'écrites sur le site. Liste vide si aucune adresse n\'apparaît.'
        : '- "cities" : liste vide, ce commerce n\'a pas de point de vente physique.',
      '- "businessName" : le nom commercial.',
      '- "summary" : deux phrases décrivant l\'activité et ce qui est vendu.',
      '- "suggestedNiche" : la niche en quelques mots.',
      '- "suggestedAudience" : à qui s\'adresse ce commerce, en une phrase.',
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 900,
  });

  await saveSiteAnalysis(site.siteId, analysis);

  return { ...analysis, pageCount: site.pages.length };
}

// ── Étape 5 : les concurrents ────────────────────────────────────────────────

/**
 * Au moins un concurrent, sinon la réponse est refusée.
 *
 * Le `.catch([])` d'origine transformait toute réponse hors-format en liste
 * vide : le schéma passait, aucun fournisseur de secours n'était tenté, et
 * l'étape s'ouvrait sur « nous n'avons pas réussi » sans qu'une seule erreur
 * soit remontée. Exiger une entrée rend l'échec visible et laisse `askJson`
 * rejouer l'appel sur le second modèle.
 */
const competitorsSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().nullable().catch(null),
        reason: z.string().nullable().catch(null),
      }),
    )
    .min(1)
    .max(12),
});

/** Le plafond affiché : au-delà, la liste se coche plus qu'elle ne se lit. */
const MAX_COMPETITORS = 8;

export type SuggestedCompetitor = {
  name: string;
  url: string | null;
  domain: string | null;
  reason: string | null;
  rank: number;
};

/** Le domaine d'une adresse écrite à la main, ou null si elle est illisible. */
function toDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * La fiche du commerce, telle qu'elle est donnée au modèle.
 *
 * Gemini et le modèle de repli lisent exactement le même brief : si l'un tombe,
 * l'autre travaille sur les mêmes faits, et la liste ne change pas de nature
 * selon le fournisseur qui a répondu.
 */
function competitorBrief({
  siteUrl,
  description,
  audience,
  niche,
  targetMarket,
  cities,
  physical,
}: {
  siteUrl: string | null;
  description: string | null;
  audience: string | null;
  niche: string | null;
  targetMarket: string | null;
  cities: string[];
  physical: boolean;
}): string {
  return [
    siteUrl ? `Site : ${siteUrl}` : "",
    niche ? `Niche : ${niche}` : "",
    description ? `Activité : ${description}` : "",
    audience ? `Clientèle visée : ${audience}` : "",
    targetMarket ? `Marché visé : ${targetMarket}` : "",
    physical && cities.length > 0 ? `Villes du commerce : ${cities.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** La consigne commune : ce qui compte pour qu'un concurrent soit « direct ». */
function competitorRules(physical: boolean): string[] {
  return [
    physical
      ? "Ne retiens que des concurrents établis dans ces villes ou leur agglomération immédiate : un acteur national ne dispute pas les mêmes réponses IA qu'un artisan à trois rues de là."
      : "Ne retiens que des concurrents qui visent le même marché en ligne.",
    "N'inclus jamais le commerce lui-même, ni un annuaire, un comparateur, une place de marché ou un article de blog : on cherche des entreprises concurrentes, pas des pages qui les listent.",
  ];
}

/**
 * Met la liste en forme : dédoublonnage, retrait du commerce lui-même, rang.
 *
 * Le dédoublonnage se fait sur le domaine quand il existe, sur le nom sinon —
 * un même concurrent revient volontiers deux fois sous deux orthographes quand
 * le modèle a lu plusieurs pages à son sujet.
 */
function normalizeCompetitors(
  found: { name: string; url: string | null; reason: string | null }[],
  ownDomain: string | null,
): SuggestedCompetitor[] {
  const seen = new Set<string>();
  const out: SuggestedCompetitor[] = [];

  for (const competitor of found) {
    const name = competitor.name.trim();
    if (!name) continue;

    const domain = toDomain(competitor.url);
    if (domain && ownDomain && domain === ownDomain) continue;

    const key = domain ?? name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      url: competitor.url,
      domain,
      reason: competitor.reason,
      rank: out.length + 1,
    });
    if (out.length === MAX_COMPETITORS) break;
  }

  return out;
}

/**
 * Les concurrents directs du commerce, cherchés sur le web.
 *
 * Gemini avec la recherche Google passe en premier, et ce n'est pas un détail
 * de fournisseur : un modèle qui répond de mémoire propose des enseignes
 * vraisemblables — parfois fermées, parfois inventées, souvent nationales alors
 * qu'on cherche la rue d'à côté. Aller voir l'index règle la question à la
 * source, et le client reçoit des noms qu'il reconnaît.
 *
 * DeepSeek reste branché derrière, sans recherche : si la clé Gemini manque ou
 * si l'appel tombe, mieux vaut une liste à corriger qu'une étape vide.
 */
export async function suggestCompetitors({
  siteUrl,
  description,
  audience,
  niche,
  targetMarket,
  cities,
  businessKind,
}: {
  siteUrl: string | null;
  description: string | null;
  audience: string | null;
  niche: string | null;
  targetMarket: string | null;
  cities: string[];
  businessKind: string | null;
}): Promise<SuggestedCompetitor[]> {
  const physical = hasPhysicalPresence(businessKind);
  const brief = competitorBrief({
    siteUrl,
    description,
    audience,
    niche,
    targetMarket,
    cities,
    physical,
  });
  const rules = competitorRules(physical);
  const ownDomain = toDomain(siteUrl);

  const grounded = await askGeminiGrounded(competitorsSchema, {
    label: "Concurrents",
    maxOutputTokens: 2200,
    prompt: [
      `Avec la recherche Google, trouve les concurrents directs les plus sérieux du commerce décrit ci-dessous. Vise ${MAX_COMPETITORS} entreprises, et n'en garde aucune dont tu ne sois sûr.`,
      "",
      brief,
      "",
      ...rules,
      "Vérifie chaque entreprise sur le web avant de la citer : elle doit être en activité aujourd'hui, et l'adresse indiquée doit être son site officiel.",
      "",
      "Réponds UNIQUEMENT par un objet JSON de cette forme, en français, sans commentaire autour :",
      "{",
      '  "competitors": [{ "name": "…", "url": "https://…" ou null, "reason": "une phrase disant en quoi il dispute la même clientèle" }]',
      "}",
      "",
      "Classe du concurrent le plus direct au moins direct.",
    ].join("\n"),
  });

  if (grounded) {
    const list = normalizeCompetitors(grounded.data.competitors, ownDomain);
    if (list.length > 0) return list;
  }

  const { competitors } = await askJson(competitorsSchema, {
    system: SYSTEM,
    prompt: [
      `Identifie les ${MAX_COMPETITORS} concurrents les plus directs du commerce décrit ci-dessous.`,
      "",
      brief,
      "",
      ...rules,
      "Ne propose que des entreprises dont tu es sûr de l'existence.",
      "",
      'Réponds en JSON : { "competitors": [ { "name": …, "url": … ou null, "reason": une phrase expliquant en quoi il est direct } ] },',
      "classés du plus direct au moins direct.",
    ].join("\n"),
    maxTokens: 1600,
  });

  return normalizeCompetitors(competitors, ownDomain);
}

// ── Étape 6 : la tonalité ────────────────────────────────────────────────────

const toneSchema = z.object({
  tone: z.string().nullable().catch(null),
});

/**
 * Lit un article donné en exemple et en tire une consigne de ton réutilisable
 * par les agents rédactionnels.
 *
 * On ne garde pas l'article : ce qui compte est la manière, pas le sujet. Un
 * lien illisible n'est pas une erreur bloquante — l'étape est facultative, elle
 * rend simplement `null`.
 */
export async function readTone(sampleUrl: string): Promise<string | null> {
  const { pages } = await crawlSite(sampleUrl, { maxPages: 1, maxDepth: 0 });
  const article = pages[0]?.markdown?.trim();
  if (!article) return null;

  const { tone } = await askJson(toneSchema, {
    system: SYSTEM,
    prompt: [
      "Voici un article que le client donne en exemple de sa manière d'écrire.",
      "",
      article.slice(0, 12_000),
      "",
      'Réponds en JSON : { "tone": … } — trois à quatre phrases décrivant la tonalité à reproduire :',
      "niveau de langue, personne employée (tu/vous/nous), rythme des phrases, usage de l'humour,",
      "densité technique, et ce qu'il faut éviter pour ne pas sonner faux.",
    ].join("\n"),
    maxTokens: 500,
  });

  return tone;
}
