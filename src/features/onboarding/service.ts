import "server-only";

import { z } from "zod";
import { askJson } from "@/lib/ai/client";
import { aiLog } from "@/lib/ai/log";
import { askGeminiGrounded } from "@/lib/ai/gemini";
import { buildCorpus, getOrCrawlSite, saveSiteAnalysis } from "@/lib/crawl/store";
import { crawlSite } from "@/lib/crawl/firecrawl";
import {
  collectBrandColors,
  normalizeCssColor,
  type ColorCandidate,
} from "@/lib/geo/brand-color";
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
    // Lire un corpus déjà crawlé et en extraire langue, villes et niche : de
    // l'extraction, pas du jugement. DeepSeek Flash, comme le reste du tunnel.
    role: "default",
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
    // Repli quand Gemini n'a rien rendu : de mémoire, donc à petit prix.
    role: "default",
    maxTokens: 1600,
  });

  return normalizeCompetitors(competitors, ownDomain);
}

// ── L'identité de marque : sa manière d'écrire et sa couleur ─────────────────

const brandSchema = z.object({
  tone: z.string().nullable().catch(null),
  color: z.string().nullable().catch(null),
});

/** La consigne de ton, la page qui l'a fournie, et la couleur de la marque. */
export type BrandReading = {
  tone: string | null;
  /** URL réellement lue : l'article trouvé, la page d'accueil, ou le lien donné. */
  sourceUrl: string | null;
  /** Vrai si la page retenue est un article, faux si c'est la page d'accueil. */
  fromArticle: boolean;
  /**
   * La couleur principale du site, en hexadécimal — celle des boutons d'appel à
   * l'action, ou celle que la charte déclare. `null` quand le site n'emploie
   * que du noir et du gris, ce qui arrive et n'est pas un échec.
   */
  color: string | null;
};

/** Une page du crawl, réduite à ce qui sert à la choisir. */
type CandidatePage = { url: string; title: string | null; markdown: string; wordCount: number };

/**
 * Les segments d'URL qui annoncent un article plutôt qu'une page de service.
 * Un site français en emploie rarement d'autres, et une correspondance de trop
 * coûte moins qu'un ton relevé sur une page de mentions légales.
 */
const ARTICLE_PATH = /\/(blog|article|articles|actualites?|actus?|news|journal|magazine|conseils?|guides?|dossiers?|posts?|carnet)(\/|$)/i;

/**
 * Les pages qui ne disent rien de la manière d'écrire du client.
 *
 * Ce sont des textes de forme : des conditions de vente, une politique de
 * confidentialité, des mentions légales. Personne ne les écrit, on les recopie,
 * et le ton qu'on y relèverait est celui d'un modèle de contrat — la dernière
 * voix dans laquelle on voudrait voir sortir un article de commerçant.
 *
 * La liste est volontairement large, et les variantes d'écriture y sont toutes :
 * un même texte s'appelle `/cgv`, `/conditions-generales-de-vente` ou
 * `/politique-de-vente` selon le site, et un seul de ces chemins oublié suffit à
 * faire lire la mauvaise page.
 */
const NOT_EDITORIAL =
  /\/(mentions?-legales?|cgv|cgu|cgav|conditions|conditions-generales[\w-]*|politique[\w-]*|confidentialite|privacy|donnees-personnelles|rgpd|gdpr|cookies?|livraison|retours?|remboursement|garantie|paiement|panier|cart|checkout|compte|account|connexion|login|inscription|plan-du-site|sitemap|contact|recrutement|mentions)(\/|$)/i;

/**
 * Les pages où une marque se raconte elle-même.
 *
 * Un commerçant qui ne tient pas de blog n'a écrit que deux textes de sa main :
 * sa page d'accueil et sa page « à propos ». La seconde est souvent la plus
 * parlante des deux — l'accueil est fait de titres et de boutons, l'« à propos »
 * de phrases entières — et elle restait pourtant hors du relevé, qui ne
 * connaissait que l'article et l'accueil.
 */
const ABOUT_PATH =
  /\/(a-propos|apropos|about(-us)?|qui-sommes-nous|notre-histoire|histoire|story|notre-equipe|equipe|team|notre-maison|la-maison|notre-atelier|savoir-faire|nos-valeurs|valeurs|philosophie|engagements?|presentation)(\/|$)/i;

/** Un mot-clé d'article dans le titre : le second indice après l'URL. */
const ARTICLE_TITLE = /\b(comment|pourquoi|guide|conseils?|astuces?|top \d|\d+ (?:façons|raisons|erreurs|étapes))\b/i;

/** Pages retenues au plus pour composer l'échantillon soumis au modèle. */
const MAX_TONE_PAGES = 3;

/**
 * Les pages où lire la manière d'écrire du client.
 *
 * L'ordre de préférence tient en une phrase : un article s'il y en a un, sinon
 * la page d'accueil et les pages où la marque se raconte. Un article est du
 * texte écrit pour être lu, et un seul suffit à faire apparaître un rythme de
 * phrase ; entre deux, le plus fourni gagne.
 *
 * Sans article — le cas de la plupart des commerçants — on ne lit plus la seule
 * page d'accueil. Une accueil est faite de titres, de boutons et d'arguments de
 * dix mots : on y relève une manière de vendre plutôt qu'une manière d'écrire.
 * Les pages « à propos », « notre histoire », « qui sommes-nous » sont, elles,
 * faites de phrases entières, et ce sont les seules du site où le commerçant
 * parle en son nom. On les lit donc avec l'accueil, jusqu'à trois pages, et le
 * modèle voit la voix plutôt qu'une accroche.
 *
 * Les pages de forme sont écartées d'entrée et ne reviennent par aucun repli :
 * des conditions de vente ou une politique de confidentialité sont recopiées
 * d'un modèle, et un ton relevé dessus ferait écrire des articles en langue de
 * contrat. Mieux vaut aucun ton qu'un ton faux — c'est aussi pourquoi la
 * fonction rend une liste vide plutôt que la première page venue.
 */
function pickToneSources(pages: CandidatePage[], homeUrl: string): CandidatePage[] {
  const isHome = (page: CandidatePage): boolean => {
    try {
      return new URL(page.url).pathname.replace(/\/+$/, "") === "";
    } catch {
      return page.url === homeUrl;
    }
  };

  const usable = pages.filter(
    (page) => page.markdown.trim().length > 400 && (isHome(page) || !NOT_EDITORIAL.test(page.url)),
  );
  if (usable.length === 0) return [];

  const articles = usable
    .filter((page) => !isHome(page))
    .filter(
      (page) =>
        ARTICLE_PATH.test(page.url) ||
        ARTICLE_TITLE.test(page.title ?? "") ||
        // La longueur seule ne fait un article que hors des pages d'identité :
        // une page « à propos » bavarde en compte souvent six cents, et la
        // prendre pour un article la privait de la lecture d'ensemble.
        (page.wordCount >= 600 && !ABOUT_PATH.test(page.url)),
    )
    .sort((a, b) => {
      const pathScore = Number(ARTICLE_PATH.test(b.url)) - Number(ARTICLE_PATH.test(a.url));
      return pathScore !== 0 ? pathScore : b.wordCount - a.wordCount;
    });

  if (articles[0]) return [articles[0]];

  // L'accueil ouvre — c'est là que la marque se présente — et les pages
  // d'identité suivent, la plus fournie d'abord.
  const home = usable.find(isHome);
  const about = usable
    .filter((page) => !isHome(page) && ABOUT_PATH.test(page.url))
    .sort((a, b) => b.wordCount - a.wordCount);

  return [...(home ? [home] : []), ...about].slice(0, MAX_TONE_PAGES);
}

/**
 * Ce qu'on soumet au modèle pour relever la tonalité.
 *
 * Douze mille caractères, soit trois à quatre mille tokens : de quoi couvrir un
 * article entier, sans faire porter au prompt la moitié d'un crawl. Au-delà, le
 * modèle ne lit pas mieux la voix du client, il coûte seulement plus cher et
 * met plus longtemps à répondre.
 */
const TONE_SAMPLE_CHARS = 12_000;

/**
 * L'échantillon soumis au modèle, composé des pages retenues.
 *
 * Le budget se partage entre elles au lieu d'aller au premier arrivé : une
 * accueil bavarde de onze mille caractères aurait sinon mangé toute la place, et
 * la page « à propos » — souvent la plus parlante des deux — ne serait arrivée
 * que par trois lignes. Chaque page est annoncée par son adresse : le modèle
 * lit alors trois textes d'un même auteur, et non un seul texte décousu dont
 * les ruptures passeraient pour un changement de ton.
 */
function composeToneSample(pages: CandidatePage[]): string {
  const share = Math.floor(TONE_SAMPLE_CHARS / Math.max(1, pages.length));

  return pages
    .map((page) => `--- ${page.url} ---\n${page.markdown.trim().slice(0, share)}`)
    .join("\n\n");
}

/**
 * La manière d'écrire du client et sa couleur, en un seul appel.
 *
 * Les deux questions voyagent ensemble parce qu'elles portent sur le même
 * client et se répondent sur la même page : les séparer doublerait le coût et
 * l'attente pour deux champs enregistrés côte à côte. Le texte est lu par le
 * modèle ; la couleur, elle, est d'abord relevée dans le CSS du site
 * (`collectBrandColors`) et le modèle ne fait que trancher entre les teintes
 * réellement employées. Il ne peut donc pas en inventer une : la réponse est
 * refusée si elle ne figure pas dans la liste soumise.
 */
async function readBrandFrom(
  text: string,
  fromArticle: boolean,
  colors: ColorCandidate[],
): Promise<{ tone: string | null; color: string | null }> {
  aiLog("Tonalité — texte soumis au modèle", {
    source: fromArticle ? "article du client" : "accueil et pages d'identité",
    caracteresDisponibles: text.length,
    caracteresEnvoyes: Math.min(text.length, TONE_SAMPLE_CHARS),
    couleursRelevees: colors.map((candidate) => candidate.hex),
  });

  const colorBlock = colors.length
    ? [
        "",
        "Voici les couleurs relevées dans le CSS de son site, de la plus employée à la moins,",
        "avec l'endroit où chacune a été lue :",
        ...colors.map(
          (candidate) => `- ${candidate.hex} (${candidate.source}, poids ${candidate.weight})`,
        ),
      ]
    : [];

  const colorRule = colors.length
    ? [
        '"color" : la couleur de marque, RECOPIÉE À L\'IDENTIQUE depuis la liste ci-dessus —',
        "celle qu'un visiteur retiendrait du site : celle des boutons d'appel à l'action, ou",
        "celle que la charte déclare. Écarte les teintes qui ne servent qu'à un pictogramme, à",
        "une alerte (rouge d'erreur, vert de validation) ou à un fond de page. Si aucune ne fait",
        "office de couleur de marque, réponds null plutôt que d'en choisir une au hasard.",
      ]
    : ['"color" : null — aucune couleur n\'a pu être relevée sur le site.'];

  const { tone, color } = await askJson(brandSchema, {
    system: SYSTEM,
    prompt: [
      fromArticle
        ? "Voici un article publié par le client. Il sert d'exemple de sa manière d'écrire."
        : "Voici les pages où le client parle en son nom : sa page d'accueil, et celles où il présente sa maison. Le site ne publie pas d'articles : c'est tout ce qu'il ait écrit lui-même. Chaque page est annoncée par son adresse ; elles sont du même auteur, lis-les comme un seul échantillon.",
      "",
      text.slice(0, TONE_SAMPLE_CHARS),
      ...colorBlock,
      "",
      'Réponds en JSON : { "tone": …, "color": … }.',
      "",
      '"tone" : quatre à six phrases décrivant la tonalité à REPRODUIRE, assez',
      "précises pour qu'un rédacteur qui n'a jamais vu ce site écrive dans la même voix :",
      "- le niveau de langue et le vocabulaire de métier réellement employé ;",
      "- la personne (tu / vous / nous / impersonnel) et la façon de s'adresser au lecteur ;",
      "- la longueur moyenne des phrases et le rythme (phrases hachées, longues, alternance) ;",
      "- l'humour, les images, les prises de position : présents ou absents, et sous quelle forme ;",
      "- la densité technique : chiffres, exemples concrets, jargon expliqué ou non ;",
      "- deux ou trois tournures caractéristiques, citées entre guillemets ;",
      "- ce qu'il faut éviter pour ne pas sonner faux dans cette voix.",
      "",
      ...colorRule,
      "",
      "Décris la MANIÈRE, jamais le sujet : aucune phrase de ta réponse ne doit parler de ce dont le texte parle.",
    ].join("\n"),
    // Lire une manière d'écrire dans douze mille caractères est une lecture, pas
    // un raisonnement : `gpt-5.4-nano` la rend en trois secondes et demie là où
    // le grand modèle DeepSeek en demandait trente. Le ton relevé ici est
    // ensuite enregistré et rejoué à chaque rédaction : il vaut son modèle
    // dédié. Le rôle `tone` vise donc le nano d'OpenAI, et retombe sur DeepSeek
    // Flash si la clé manque.
    role: "tone",
    // Le budget vaut pour la réponse seule : la marge de réflexion est ajoutée
    // par le client IA. Six phrases de description tiennent largement dans ces
    // neuf cents tokens.
    maxTokens: 900,
  });

  return { tone: tone?.trim() || null, color: pickAnswerColor(color, colors) };
}

/**
 * La couleur retenue, une fois la réponse du modèle confrontée aux relevés.
 *
 * Un modèle rapide recopie parfois de travers — un chiffre de moins, une teinte
 * voisine, un nom de couleur. Une réponse hors liste est donc écartée au profit
 * du premier candidat, qui est déjà le plus employé du site : mieux vaut la
 * couleur la plus posée sur les boutons qu'une couleur inventée. Et quand le
 * modèle répond explicitement `null`, on le suit — il a lu la page, pas nous.
 */
function pickAnswerColor(answer: string | null, colors: ColorCandidate[]): string | null {
  if (colors.length === 0) return null;
  if (answer == null) return null;

  const normalized = normalizeCssColor(answer);
  if (!normalized) return colors[0].hex;

  const match = colors.find((candidate) => candidate.hex.slice(1) === normalized);
  return match?.hex ?? colors[0].hex;
}

/**
 * La manière d'écrire du client et sa couleur, relevées sur son propre site.
 *
 * Le tunnel demandait un lien d'article et une couleur choisie à la pipette, et
 * la plupart des clients passaient l'étape : ils n'ont pas ce lien sous la main,
 * ne se relisent pas comme des exemples de style, et ne connaissent pas le code
 * hexadécimal de leur propre charte. Sans ces repères, tous les articles
 * produits sortaient dans la même voix, celle de personne, et l'atelier
 * affichait un rond gris là où le client attend sa couleur. On va donc les
 * chercher nous-mêmes : le site est déjà crawlé, il suffit d'y repérer un
 * article et, à défaut, de lire la page d'accueil ; la couleur, elle, se relève
 * dans le CSS de cette même page d'accueil.
 *
 * Un lien fourni à la main reste prioritaire pour le texte : c'est le client qui
 * sait le mieux quel article le représente. La couleur, elle, se lit toujours
 * sur la page d'accueil — c'est là que sont les boutons.
 *
 * Appel réservé aux offres payantes — Coup de Boost compris : ce sont les
 * niveaux où le ton relevé sert vraiment, puisque ce sont eux qui font écrire
 * les articles (cf. `ensureBrandIdentity` et `contextForWriting`).
 */
export async function detectBrandIdentity({
  siteUrl,
  sampleUrl,
}: {
  siteUrl: string | null;
  sampleUrl?: string | null;
}): Promise<BrandReading> {
  const empty: BrandReading = { tone: null, sourceUrl: null, fromArticle: false, color: null };

  // Les couleurs se relèvent sur la page d'accueil, quel que soit le texte lu :
  // un article intérieur reprend le thème du site sans en déclarer la charte.
  const colors = siteUrl ? await collectBrandColors(siteUrl).catch(() => []) : [];

  // Le client a désigné un texte : on lit celui-là, sans rien chercher d'autre.
  if (sampleUrl) {
    const { pages } = await crawlSite(sampleUrl, { maxPages: 1, maxDepth: 0 });
    const article = pages[0]?.markdown?.trim();
    if (!article) return { ...empty, color: colors[0]?.hex ?? null };
    const read = await readBrandFrom(article, true, colors);
    return { ...read, sourceUrl: sampleUrl, fromArticle: true };
  }

  if (!siteUrl) return empty;

  // Le crawl de l'accueil est en base : on le relit, on ne recrawle pas.
  const site = await getOrCrawlSite(siteUrl, { maxPages: 25, maxDepth: 2 });
  const sources = pickToneSources(site.pages, site.url);

  // Aucun texte exploitable : la couleur, elle, a pu être relevée. On rend ce
  // qu'on a plutôt que de tout jeter parce que la moitié manque.
  if (sources.length === 0) return { ...empty, color: colors[0]?.hex ?? null };

  const first = sources[0];
  const fromArticle = first.url !== site.url && ARTICLE_PATH.test(first.url);

  // La page citée au client est la première de la liste : c'est celle qui pèse
  // le plus dans le relevé, et lui en montrer trois ne l'aiderait pas à juger.
  const read = await readBrandFrom(composeToneSample(sources), fromArticle, colors);
  return { ...read, sourceUrl: first.url, fromArticle };
}
