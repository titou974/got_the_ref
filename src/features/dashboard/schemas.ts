import { z } from "zod";

import { ON_PAGE_ELEMENTS } from "@/constants/plans";

/** Les entrées du tableau de bord, validées avant toute écriture. */

export const connectSiteSchema = z.object({
  platform: z.string().min(2).max(40),
  /**
   * Les identifiants de la plateforme, dont les noms de champs viennent du
   * registre `constants/site-platforms`. Le formulaire n'envoie que ceux du
   * connecteur choisi, et la valeur reste une chaîne quoi qu'il arrive.
   */
  credentials: z.record(z.string().min(1).max(60), z.string().max(4000)),
});

export const disconnectSiteSchema = z.object({});

/** L'élément on-page dont le client redemande une version. */
export const regenerateOnPageSchema = z.object({
  element: z.enum(ON_PAGE_ELEMENTS),
});

export const planArticlesSchema = z.object({
  count: z.number().int().min(1).max(12).default(4),
  /** Jours entre deux publications du planning. */
  everyDays: z.number().int().min(1).max(30).default(7),
});

export const articleIdSchema = z.object({ id: z.string().min(1) });

export const writeArticleSchema = z.object({
  id: z.string().min(1),
  /** Ce que le client veut voir changer dans la reprise. */
  instruction: z.string().max(600).optional(),
});

/**
 * Déplacer la date de publication, sans toucher au texte.
 *
 * Séparé de `updateArticleSchema`, qui exige le titre et le corps : planifier
 * depuis le calendrier n'a pas l'article sous la main, et le lui faire porter
 * pour changer une date renverrait quatre-vingts kilo-octets de Markdown au
 * serveur pour écrire un horodatage.
 */
export const scheduleArticleSchema = z.object({
  id: z.string().min(1),
  scheduledFor: z.string().datetime(),
});

/**
 * Valider un article, en posant au besoin sa date de départ.
 *
 * Les deux gestes voyagent ensemble parce qu'ils se décident ensemble : la
 * modale de validation montre la date à laquelle l'article partira, et le
 * client la corrige là, dans la même fenêtre. Les séparer aurait demandé deux
 * allers-retours pour une seule décision — et laissé la porte ouverte à un
 * article validé sans date, que la file n'aurait jamais pris.
 */
export const approveArticleSchema = z.object({
  id: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
});

/** Le réglage du pilote automatique, porté par le rattachement du site. */
export const autoPublishSchema = z.object({ autoPublish: z.boolean() });

export const updateArticleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(4).max(160),
  body: z.string().min(1).max(80_000),
  excerpt: z.string().max(600).optional(),
  scheduledFor: z.string().datetime().optional(),
  /**
   * Le plan et la consigne de chaque section, tels que l'atelier les affiche.
   * Ils voyagent avec le texte : le client corrige souvent les deux du même
   * geste, et deux enregistrements séparés laisseraient l'un des deux en retard.
   */
  outline: z
    .array(
      z.object({
        heading: z.string().min(1).max(160),
        level: z.union([z.literal(2), z.literal(3)]),
        instruction: z.string().max(600).default(""),
      }),
    )
    .max(20)
    .optional(),
});

export const brandVoiceSchema = z.object({
  instructions: z.string().max(1500),
  /** Une entrée par ligne dans le formulaire, découpée avant validation. */
  banned: z.array(z.string().min(1).max(80)).max(40).default([]),
});

/**
 * Les réglages du compte, enregistrés d'un seul geste.
 *
 * Le formulaire couvre trois tables — le compte, la fiche d'accueil, le ton —
 * mais reste un seul écran : le client corrige souvent son nom et sa niche dans
 * la même minute, et trois boutons « enregistrer » lui feraient croire à trois
 * enregistrements séparés à ne pas oublier.
 *
 * L'adresse e-mail n'est pas là : la changer déplace la clé de connexion et
 * demande une vérification, ce que cet écran ne sait pas faire. Le champ est
 * affiché en lecture seule et rien ne l'accepte en entrée.
 */
export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  /**
   * Le type de commerce décide de la présence de l'onglet Google Maps : une
   * boutique a une fiche, une activité en ligne n'en a pas. La chaîne vide est
   * acceptée pour les comptes ouverts avant ce champ, qui n'en ont pas encore.
   */
  businessKind: z.enum(["", "physical", "online", "both"]),
  niche: z.string().trim().max(120),
  /** Champ libre, comme à l'étape « marché » du tunnel : « Suisse romande ». */
  targetMarket: z.string().trim().max(120),
  description: z.string().trim().max(1500),
  audience: z.string().trim().max(600),
  toneInstructions: z.string().trim().max(1500),
  /** Une entrée par ligne dans le formulaire, découpée avant validation. */
  toneBanned: z.array(z.string().min(1).max(80)).max(40).default([]),
});

export const prospectIdSchema = z.object({ id: z.string().min(1) });

export const prospectStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["found", "drafted", "contacted", "replied", "published", "declined"]),
});

export const planGooglePostsSchema = z.object({
  count: z.number().int().min(1).max(12).default(4),
  everyDays: z.number().int().min(1).max(30).default(7),
});

export const googlePostIdSchema = z.object({ id: z.string().min(1) });

/**
 * Le relevé de la fiche Google Maps.
 *
 * `force` passe outre le délai de garde entre deux relevés : le client vient de
 * corriger sa fiche chez Google et veut la revoir tout de suite, quitte à payer
 * un second run Apify.
 */
export const refreshMapsPlaceSchema = z.object({
  force: z.boolean().default(false),
});

/** Les identifiants d'avis pour lesquels on veut une réponse rédigée. */
export const draftReviewRepliesSchema = z.object({
  /** Vide = tous les avis sans réponse du propriétaire. */
  reviewIds: z.array(z.string().min(1).max(200)).max(12).default([]),
});

export const reviewReplySchema = z.object({ id: z.string().min(1) });

/** La relecture des horaires de la page d'accueil. */
export const readSiteHoursSchema = z.object({});
