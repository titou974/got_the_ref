import { z } from "zod";

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
