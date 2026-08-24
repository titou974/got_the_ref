import { z } from "zod";
import { BUSINESS_KINDS } from "./steps";

/**
 * Ce que chaque étape accepte. Les schémas restent volontairement tolérants sur
 * la forme (une URL peut arriver sans « https:// », une ville avec des espaces)
 * et stricts sur le fond : ce qui est obligatoire l'est vraiment, le reste peut
 * rester vide sans bloquer le tunnel.
 */

/** Une URL saisie à la main : on complète le schéma manquant avant de valider. */
export const looseUrl = z
  .string()
  .trim()
  .min(3, "Indiquez l'adresse de votre site.")
  .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
  .refine((value) => {
    try {
      const url = new URL(value);
      return Boolean(url.hostname.includes("."));
    } catch {
      return false;
    }
  }, "Cette adresse ne ressemble pas à un site web.");

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "" : /^https?:\/\//i.test(value) ? value : `https://${value}`))
  .refine((value) => {
    if (value === "") return true;
    try {
      return Boolean(new URL(value).hostname.includes("."));
    } catch {
      return false;
    }
  }, "Cette adresse ne ressemble pas à un lien valide.")
  .optional()
  .default("");

/** Étape 1 — la forme du commerce. */
export const businessKindSchema = z.object({
  businessKind: z.enum(BUSINESS_KINDS),
});

/**
 * Étape 2 — le site, et la fiche Google Maps pour un commerce qui reçoit du
 * public. La fiche reste facultative même dans ce cas : tout le monde n'en a
 * pas, et la réclamer bloquerait le tunnel sur un lien introuvable.
 */
export const siteSchema = z.object({
  siteUrl: looseUrl,
  mapsUrl: optionalUrl,
});

/** Étape 3 — marché visé et villes couvertes. */
export const marketSchema = z.object({
  targetMarket: z.string().trim().min(2, "Indiquez le marché visé."),
  cities: z.array(z.string().trim().min(1)).max(30).default([]),
});

/** Étape 4 — ce que le client dit de son activité. */
export const descriptionSchema = z.object({
  description: z.string().trim().min(20, "Décrivez votre activité en quelques phrases."),
  audience: z.string().trim().min(3, "À qui vous adressez-vous ?"),
  niche: z.string().trim().min(2, "Quelle est votre niche ?"),
});

/** Étape 5 — les concurrents retenus parmi ceux proposés. */
export const competitorsSchema = z.object({
  selected: z.array(z.string().min(1)).max(20).default([]),
});

/** Étape 6 — la charte et le ton. Tout y est facultatif. */
export const toneSchema = z.object({
  brandColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Utilisez un code couleur hexadécimal, par exemple #1B1B1F.")
    .transform((value) => (value.startsWith("#") ? value : `#${value}`))
    .optional()
    .or(z.literal("")),
  toneSampleUrl: optionalUrl,
});

export type BusinessKindInput = z.infer<typeof businessKindSchema>;
export type SiteInput = z.infer<typeof siteSchema>;
export type MarketInput = z.infer<typeof marketSchema>;
export type DescriptionInput = z.infer<typeof descriptionSchema>;
export type CompetitorsInput = z.infer<typeof competitorsSchema>;
export type ToneInput = z.infer<typeof toneSchema>;
