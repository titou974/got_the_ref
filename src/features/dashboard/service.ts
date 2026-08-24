import "server-only";

import { z } from "zod";
import { askJson } from "@/lib/ai/client";
import type { DashboardContext } from "./queries";

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
  "Aucune formule d'ouverture creuse (« dans un monde où », « de nos jours »).",
  "Pas de tirets cadratins.",
  "Aucun chiffre, prix, date ou nom propre inventé : seuls ceux du brief.",
  "Répondre à la question posée dès la première phrase du paragraphe.",
].join(" ");

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
    .max(12),
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
      "Chaque sujet : un titre, le mot-clé visé, l'angle en une phrase, et un plan de 3 à 8 titres de sections.",
      "Réponds en JSON : { \"articles\": [{ \"title\", \"keyword\", \"angle\", \"outline\": [] }] }",
    ].join("\n"),
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
  topic: { title: string; keyword: string | null; outline: string[] },
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
      topic.outline.length ? `Plan retenu :\n- ${topic.outline.join("\n- ")}` : "",
      instruction ? `Demande de reprise du client : ${instruction}` : "",
      "",
      "Rédige l'article complet en Markdown (titres de niveau 2 et 3, listes quand c'est utile),",
      "entre 700 et 1200 mots, plus un chapô de deux phrases.",
      "Réponds en JSON : { \"title\", \"excerpt\", \"body\" }",
    ]
      .filter(Boolean)
      .join("\n"),
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
      "La balise title fait au plus 60 signes, la meta description au plus 155. " +
      WRITING_RULES,
    prompt: [
      brief(context),
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
      "Propose une version réécrite de chaque élément, puis dis en quoi elle change la donne.",
      "Réponds en JSON : { \"title\", \"metaDescription\", \"h1\", \"intro\", \"reasons\": [] }",
    ]
      .filter(Boolean)
      .join("\n"),
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
      "Réponds en JSON : { \"sites\": [{ \"name\", \"domain\", \"reason\", \"contactEmail\", \"contactUrl\", \"authority\" }] }",
    ].join("\n"),
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
      "Réponds en JSON : { \"subject\", \"body\" }",
    ]
      .filter(Boolean)
      .join("\n"),
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
      "Réponds en JSON : { \"posts\": [{ \"title\", \"body\", \"keyword\", \"cta\" }] }",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return result.posts;
}
