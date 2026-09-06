import { z } from "zod";
import { ONBOARDING_BUSINESS_KINDS } from "./steps";

/**
 * Ce que l'accueil accepte. Les schémas restent volontairement tolérants sur la
 * forme — une URL peut arriver sans « https:// » — et stricts sur le fond :
 * la forme du commerce et l'adresse du site sont les deux réponses sans
 * lesquelles rien ne peut commencer.
 */

/** Première étape : une adresse où l'on vous trouve, ou pas d'adresse du tout. */
export const businessKindSchema = z.object({
  businessKind: z.enum(ONBOARDING_BUSINESS_KINDS),
});

export type BusinessKindInput = z.infer<typeof businessKindSchema>;

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

/**
 * Deuxième étape : le site, et la fiche Google Maps pour un commerce qui reçoit
 * du public. La fiche reste facultative — tout le monde n'en a pas, et la
 * réclamer bloquerait le tunnel sur un lien introuvable.
 */
export const siteSchema = z.object({
  siteUrl: looseUrl,
  mapsUrl: optionalUrl,
});

export type SiteInput = z.infer<typeof siteSchema>;
