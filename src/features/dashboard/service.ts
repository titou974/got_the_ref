import "server-only";

import { z } from "zod";
import { askJson } from "@/lib/ai/client";
import type { DashboardContext } from "./queries";
import { outlineForPrompt, type OutlineSection } from "./outline";

/**
 * Ce que les agents produisent pour le tableau de bord : sujets d'articles,
 * corps rédigés, sites à démarcher, posts pour la fiche Google.
 *
 * Un seul endroit pour les prompts, et une règle commune : le modèle reçoit la
 * fiche client telle qu'elle a été remplie pendant l'accueil, jamais un résumé
 * réécrit à la volée. Deux passes qui partent du même brief écrivent dans la
 * même voix.
 */

/** Le contexte, mis à plat pour le prompt. */
function brief(context: DashboardContext, voice?: { instructions: string; banned: string[] } | null) {
  const analysis = context.analysis;
  const lines = [
    `Commerce : ${context.businessName || context.domain || "inconnu"}`,
    `Site : ${context.siteUrl ?? context.domain ?? "inconnu"}`,
    `Niche : ${context.niche ?? analysis?.profile.niche ?? "inconnue"}`,
    `Type : ${analysis?.businessType ?? "inconnu"}`,
    context.cities.length ? `Villes couvertes : ${context.cities.join(", ")}` : null,
    analysis?.profile.location ? `Localisation : ${analysis.profile.location}` : null,
    analysis?.signals.metaDescription ? `Meta description actuelle : ${analysis.signals.metaDescription}` : null,
    analysis?.signals.firstParagraph ? `Introduction actuelle : ${analysis.signals.firstParagraph}` : null,
  ].filter(Boolean);

  // Le ton relevé pendant l'accueil vient d'abord : c'est la manière d'écrire du
  // client, constatée sur son propre texte. La voix de marque passe après, parce
  // qu'elle corrige ce constat plutôt qu'elle ne le remplace.
  if (context.tone?.summary) lines.push(`Ton de la marque (relevé à l'accueil) : ${context.tone.summary}`);
  if (voice?.instructions) lines.push(`Consigne de ton du client : ${voice.instructions}`);
  if (voice?.banned.length) lines.push(`Termes interdits : ${voice.banned.join(", ")}`);

  return lines.join("\n");
}

/**
 * La consigne d'écriture, partagée par tout ce qui produit du texte publié.
 *
 * Les tournures listées sont celles qui trahissent un texte de modèle. Une IA
 * qui cite un commerce préfère une page qui répond à la question ; un client qui
 * relit son article, lui, préfère ne pas y lire « dans un monde où ».
 */
const WRITING_RULES = [
  "Français courant, phrases courtes, voix active.",
  "Aucun superlatif publicitaire (« incontournable », « niché au cœur de », « véritable »).",
  "Aucune formule d'ouverture creuse (« dans un monde où », « de nos jours », « que vous soyez… »).",
  "Pas de tirets cadratins ni de tirets demi-cadratins pour séparer deux idées : une virgule, un deux-points ou un point.",
  "Aucun chiffre, prix, date, distinction ou nom propre inventé : seuls ceux du brief.",
  "Répondre à la question posée dès la première phrase du paragraphe, avant toute mise en contexte.",
  "Chaque paragraphe doit rester compréhensible sorti de son article : c'est ainsi qu'un assistant le cite.",
  "Jamais de conclusion qui résume ce qui vient d'être dit ni d'appel à l'action générique.",
  // Les marques d'un texte écrit par un modèle, relevées par le projet de
  // nettoyage IA de Wikipédia. Un client les repère sans savoir les nommer :
  // il dit « ça ne me ressemble pas », et le texte finit non publié.
  "Aucune phrase qui gonfle l'importance d'un fait ordinaire (« témoigne de », « joue un rôle clé », « marque un tournant », « s'inscrit dans une dynamique »).",
  "Aucun participe présent d'analyse creuse en fin de phrase (« soulignant… », « reflétant… », « garantissant… », « permettant ainsi… »).",
  "Aucune source vague : « les experts s'accordent », « selon plusieurs études », « il est reconnu que ». Nommer la source ou supprimer la phrase.",
  "Employer « est », « a », « fait » plutôt que « se positionne comme », « constitue », « propose une offre de », « dispose de ».",
  "Aucune tournure « non seulement… mais aussi », « ce n'est pas X, c'est Y », ni fin de phrase amputée en guise d'effet.",
  "Pas d'énumération systématique par trois : lister ce qu'il y a à lister, deux éléments ou quatre si c'est le compte.",
  "Pas de « de X à Y » quand X et Y ne forment pas un vrai intervalle.",
  "Pas de gras décoratif, pas de liste dont chaque puce commence par une étiquette en gras suivie de deux points, pas d'emoji.",
  "Titres de section en minuscules sauf le premier mot et les noms propres ; une section ne commence jamais par une phrase qui répète son titre.",
  "Guillemets français, jamais de guillemets courbes anglais.",
  "Pas d'annonce de ce qui suit (« voyons maintenant », « décryptons », « voici ce qu'il faut retenir ») : dire la chose directement.",
  "Pas de fausse confidence en ouverture (« soyons honnêtes », « la vérité, c'est que ») ni de formule qui prétend révéler le fond (« au fond », « la vraie question est »).",
  "Ne pas répondre à une objection que personne n'a formulée, ni écarter une option que personne n'envisagerait.",
  "Pas de chute dramatique en fragments successifs, pas de fin sur une note d'optimisme vague : le texte s'arrête sur le dernier fait utile.",
  "Varier la longueur des phrases : un texte dont toutes les phrases font la même taille se lit comme une réponse de chatbot.",
].join(" ");

/**
 * Qui écrit quoi, dans ce fichier.
 *
 * Les sujets et le corps des articles partent sur `gpt-5.4-mini` : ce sont les
 * seuls textes d'ici que le client publie mot pour mot, et le mini tient la
 * longueur d'un article en respectant son plan section par section, en quelques
 * secondes.
 *
 * Le reste — réécriture on-page, prospects, message de démarchage, posts Google
 * — est du travail de brouillon, relu avant d'être envoyé : DeepSeek Flash le
 * rend pour une fraction du prix. C'est le rôle `default` du client IA.
 */

// ── Sujets d'articles ────────────────────────────────────────────────────────

const topicsSchema = z.object({
  articles: z
    .array(
      z.object({
        title: z.string().min(8).max(120),
        keyword: z.string().min(2).max(80),
        angle: z.string().min(10).max(400),
        outline: z.array(z.string().min(3).max(120)).min(3).max(8),
      }),
    )
    .min(1)
    // Le mois éditorial complet tient dans une seule demande : vingt-deux
    // sujets, un par jour ouvré. La borne laisse deux places au-dessus, un
    // modèle rendant parfois un sujet de plus que le compte demandé.
    .max(24),
});

export type PlannedTopic = z.infer<typeof topicsSchema>["articles"][number];

/**
 * Des sujets d'articles pour les prochaines semaines.
 *
 * Les mots-clés tendances relevés par Gemini servent d'amorce quand ils
 * existent : ce sont des requêtes réelles de la niche, pas des idées de rédaction.
 */
export async function planArticleTopics(
  context: DashboardContext,
  count: number,
): Promise<PlannedTopic[]> {
  const trending = context.analysis?.trendingKeywords?.keywords ?? [];
  const trendingLine = trending.length
    ? `Mots-clés tendances relevés sur la niche : ${trending.map((k) => k.keyword).join(", ")}.`
    : "";

  const result = await askJson(topicsSchema, {
    system:
      "Tu prépares le calendrier éditorial d'un commerce pour la recherche assistée par IA. " +
      "Tu proposes des sujets qui répondent à une question que se posent vraiment ses clients. " +
      WRITING_RULES,
    prompt: [
      brief(context),
      trendingLine,
      "",
      `Propose ${count} sujets d'articles, du plus utile au moins urgent.`,
      "Chaque sujet : un titre, le mot-clé visé, l'angle en une phrase, et un plan de 3 à 8 titres de sections",
      "formulés comme des questions ou des promesses précises, dans l'ordre de lecture.",
      "Deux sujets ne doivent jamais répondre à la même question : varie l'intention (comparer, choisir, entretenir, comprendre un prix, préparer une visite).",
      "Écarte tout sujet auquel ce commerce ne peut pas répondre depuis son expérience réelle : un article générique n'est cité par aucune IA.",
      "Rends exactement ce nombre de sujets, tous différents : le calendrier a une case par sujet, et une case vide se voit.",
      "Réponds en JSON : { \"articles\": [{ \"title\", \"keyword\", \"angle\", \"outline\": [] }] }",
    ].join("\n"),
    role: "topics",
    // Un mois entier — vingt-deux sujets, chacun avec son angle et son plan de
    // trois à huit sections — ne tient pas dans le plafond par défaut : la
    // liste revenait coupée au douzième sujet, JSON tronqué en pleine chaîne.
    maxTokens: 12_000,
  });

  return result.articles;
}

// ── Rédaction d'un article ───────────────────────────────────────────────────

const draftSchema = z.object({
  title: z.string().min(8).max(140),
  excerpt: z.string().min(20).max(320),
  body: z.string().min(400),
});

export type ArticleDraft = z.infer<typeof draftSchema>;

export async function writeArticle(
  context: DashboardContext,
  topic: { title: string; keyword: string | null; outline: OutlineSection[] },
  instruction?: string | null,
): Promise<ArticleDraft> {
  return askJson(draftSchema, {
    system:
      "Tu rédiges un article de blog pour le site d'un commerce. " +
      "L'article doit pouvoir être cité tel quel par un assistant IA : une réponse nette par section, " +
      "des faits vérifiables, aucun remplissage. " +
      WRITING_RULES,
    prompt: [
      brief(context, context.brandVoice),
      "",
      `Titre de travail : ${topic.title}`,
      topic.keyword ? `Mot-clé visé : ${topic.keyword}` : "",
      topic.outline.length
        ? `Plan retenu, avec la consigne de chaque section :\n${outlineForPrompt(topic.outline)}`
        : "",
      instruction ? `Demande de reprise du client : ${instruction}` : "",
      "",
      "Respecte le plan section par section : un titre de niveau 2 ou 3 par entrée, dans l'ordre donné,",
      "et traite la consigne de la section quand elle est précisée.",
      "Ouvre chaque section par une réponse directe de 40 à 60 mots, autonome, citable telle quelle ;",
      "le développement vient après, jamais avant.",
      "Rédige l'article complet en Markdown (titres de niveau 2 et 3, listes quand c'est utile),",
      "entre 700 et 1200 mots, plus un chapô de deux phrases.",
      "Écris dans la tonalité relevée sur les textes du client : c'est sa manière de parler qui doit se reconnaître,",
      "pas celle d'un article de blog interchangeable.",
      "Avant de rendre, relis chaque paragraphe et supprime ce qui trahit un texte de modèle : phrases qui gonflent",
      "l'importance d'un fait, participes présents d'analyse, sources vagues, énumérations par trois, gras décoratif,",
      "annonces de ce qui suit, fin sur une note d'optimisme. Une phrase supprimée vaut mieux qu'une phrase de remplissage.",
      "Réponds en JSON : { \"title\", \"excerpt\", \"body\" }",
    ]
      .filter(Boolean)
      .join("\n"),
    role: "article",
    // Un article de 1200 mots plus son chapô ne tient pas dans le plafond par
    // défaut : sans ce budget, le corps revient coupé en pleine section.
    maxTokens: 8000,
  });
}

// ── Réécriture on-page ───────────────────────────────────────────────────────

const rewriteSchema = z.object({
  title: z.string().min(10).max(70),
  metaDescription: z.string().min(60).max(165),
  h1: z.string().min(6).max(90),
  intro: z.string().min(80).max(500),
  reasons: z.array(z.string().min(6).max(200)).min(1).max(5),
});

export type OnPageRewrite = z.infer<typeof rewriteSchema>;

/**
 * La réécriture proposée pour la balise title, la meta description, le H1 et le
 * premier paragraphe, avec les mots-clés tendances placés là où ils comptent.
 */
export async function rewriteOnPage(context: DashboardContext): Promise<OnPageRewrite> {
  const analysis = context.analysis;
  const keywords = analysis?.trendingKeywords?.keywords ?? [];

  return askJson(rewriteSchema, {
    system:
      "Tu réécris les éléments on-page d'une page d'accueil pour la recherche assistée par IA. " +
      "Tu rends des correctifs prêts à coller dans le CMS, pas des conseils. " +
      "La balise title fait au plus 60 signes, la meta description au plus 155, le H1 au plus 70. " +
      WRITING_RULES,
    prompt: [
      brief(context, context.brandVoice),
      "",
      `Balise title actuelle : ${analysis?.signals.title ?? "absente"}`,
      `Meta description actuelle : ${analysis?.signals.metaDescription ?? "absente"}`,
      `H1 actuel : ${analysis?.signals.h1?.[0] ?? "absent"}`,
      `Premier paragraphe actuel : ${analysis?.signals.firstParagraph ?? "absent"}`,
      keywords.length
        ? `Mots-clés à placer quand ils sont pertinents : ${keywords
            .map((k) => `${k.keyword} (${k.placements.join(", ")})`)
            .join(" · ")}`
        : "",
      "",
      "Réécris chaque élément, en gardant le nom du commerce et les faits du brief :",
      "- title : marque, niche et ville, dans cet ordre de lisibilité.",
      "- metaDescription : la niche, la ville et une raison de cliquer ; 140 à 155 signes.",
      "- h1 : une seule idée, les mots-clés de la niche en tête, jamais un slogan ni le nom seul.",
      "- intro : le premier paragraphe réécrit, 40 à 60 mots en 2 ou 3 phrases. La première phrase",
      "  répond seule à « qui, quoi, où » et doit pouvoir être citée hors contexte par un assistant ;",
      "  les suivantes ajoutent un fait vérifiable tiré du brief.",
      "",
      "Le H1 et l'intro sont les deux phrases que le client relit en premier : ils doivent sonner comme lui,",
      "pas comme un texte de modèle. Concrètement, pour ces deux éléments :",
      "- verbes simples (est, propose, ouvre, répare) plutôt que « se positionne comme » ou « constitue » ;",
      "- pas de « votre partenaire de confiance », « au cœur de », « depuis toujours », « l'excellence au service de » ;",
      "- pas de triade décorative (« qualité, proximité et savoir-faire ») : deux faits valent mieux que trois adjectifs ;",
      "- pas d'emoji, pas de gras, pas de tiret cadratin, pas de majuscule à chaque mot ;",
      "- l'intro ne répète pas le H1 : elle ajoute le fait que le H1 n'a pas la place de porter.",
      "",
      "Puis, dans \"reasons\", dis élément par élément ce que le correctif change pour la citation par une IA.",
      "Réponds en JSON : { \"title\", \"metaDescription\", \"h1\", \"intro\", \"reasons\": [] }",
    ]
      .filter(Boolean)
      .join("\n"),
    role: "default",
  });
}

// ── Prospection de liens ─────────────────────────────────────────────────────

const prospectsSchema = z.object({
  sites: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        domain: z.string().min(4).max(120),
        reason: z.string().min(10).max(400),
        contactEmail: z.string().max(160).nullable(),
        contactUrl: z.string().max(300).nullable(),
        authority: z.number().min(0).max(100),
      }),
    )
    .max(20),
});

/**
 * Les sites de la niche qui publient des articles et acceptent des contributions.
 *
 * Le modèle ne fabrique pas d'adresse : quand il n'a pas trouvé le contact, il
 * rend `null` et la fiche s'affiche avec le lien de la page contact à ouvrir à
 * la main. Une adresse inventée coûterait un envoi rebondi et une réputation
 * d'expéditeur.
 */
export async function findProspects(context: DashboardContext) {
  const result = await askJson(prospectsSchema, {
    system:
      "Tu identifies des sites éditoriaux qui pourraient accueillir un article ou un lien vers un commerce. " +
      "Tu ne proposes que des sites dont tu connais réellement l'existence. " +
      "Si tu n'as pas l'adresse de contact, mets null : n'invente jamais une adresse e-mail.",
    prompt: [
      brief(context),
      "",
      "Liste jusqu'à 12 sites de la niche (annuaires spécialisés, blogs, médias locaux, associations professionnelles)",
      "qui publient des articles et pourraient citer ce commerce.",
      "Pour chacun : le nom, le domaine, pourquoi lui, l'e-mail de contact si tu le connais, l'URL de la page contact,",
      "et une autorité estimée de 0 à 100.",
      "Écarte les sites qui n'acceptent aucune contribution extérieure, et ceux dont tu n'es pas sûr qu'ils existent encore.",
      "Réponds en JSON : { \"sites\": [{ \"name\", \"domain\", \"reason\", \"contactEmail\", \"contactUrl\", \"authority\" }] }",
    ].join("\n"),
    role: "default",
  });

  return result.sites;
}

const messageSchema = z.object({
  subject: z.string().min(6).max(120),
  body: z.string().min(200).max(2000),
});

/** Le message de prise de contact, prêt à relire puis à envoyer. */
export async function draftOutreachMessage(
  context: DashboardContext,
  prospect: { name: string; domain: string; reason: string | null },
): Promise<z.infer<typeof messageSchema>> {
  return askJson(messageSchema, {
    system:
      "Tu écris un e-mail de prise de contact entre un commerce et le responsable éditorial d'un site. " +
      "Le message propose un article ou une mention, et dit ce que le site y gagne. " +
      "Court, poli, sans flatterie. " +
      WRITING_RULES,
    prompt: [
      brief(context, context.brandVoice),
      "",
      `Destinataire : ${prospect.name} (${prospect.domain})`,
      prospect.reason ? `Pourquoi ce site : ${prospect.reason}` : "",
      "",
      "Écris l'objet et le corps du message, à la première personne, signé par le commerce.",
      "Six à dix lignes, une proposition concrète, une question finale simple.",
      "L'objet annonce la proposition, jamais une accroche marketing.",
      "Réponds en JSON : { \"subject\", \"body\" }",
    ]
      .filter(Boolean)
      .join("\n"),
    role: "default",
  });
}

// ── Posts Google Business ────────────────────────────────────────────────────

const googlePostsSchema = z.object({
  posts: z
    .array(
      z.object({
        title: z.string().min(5).max(58),
        body: z.string().min(80).max(1400),
        keyword: z.string().max(80).nullable(),
        cta: z.enum(["CALL", "BOOK", "ORDER", "LEARN_MORE", "SIGN_UP", "NONE"]),
      }),
    )
    .max(12),
});

export async function planGooglePosts(context: DashboardContext, count: number) {
  const keywords = context.analysis?.trendingKeywords?.keywords ?? [];

  const result = await askJson(googlePostsSchema, {
    system:
      "Tu rédiges des posts pour une fiche Google Business. " +
      "Un post tient en dix lignes, annonce une chose précise et donne une raison de venir. " +
      WRITING_RULES,
    prompt: [
      brief(context, context.brandVoice),
      keywords.length ? `Mots-clés tendances : ${keywords.map((k) => k.keyword).join(", ")}` : "",
      "",
      `Propose ${count} posts, un par semaine, en variant les angles (nouveauté, conseil, coulisses, saison).`,
      "Chaque post annonce une chose précise ; aucun ne doit pouvoir servir tel quel à un autre commerce.",
      "Réponds en JSON : { \"posts\": [{ \"title\", \"body\", \"keyword\", \"cta\" }] }",
    ]
      .filter(Boolean)
      .join("\n"),
    role: "default",
  });

  return result.posts;
}
