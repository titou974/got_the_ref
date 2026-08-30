import { z } from "zod";

/**
 * Ce que l'accueil accepte. Le schéma reste volontairement tolérant sur la forme
 * — une URL peut arriver sans « https:// » — et strict sur le fond : l'adresse
 * du site est la seule chose sans laquelle rien ne peut commencer.
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

/**
 * L'unique question de l'accueil : le site, et la fiche Google Maps pour un
 * commerce qui reçoit du public. La fiche reste facultative — tout le monde n'en
 * a pas, et la réclamer bloquerait le tunnel sur un lien introuvable.
 */
export const siteSchema = z.object({
  siteUrl: looseUrl,
  mapsUrl: optionalUrl,
});

export type SiteInput = z.infer<typeof siteSchema>;
