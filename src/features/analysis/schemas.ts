import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";

/**
 * Ce que la modale de la page d'accueil envoie au serveur.
 *
 * Le site et la forme du commerce viennent du formulaire d'analyse ; l'adresse
 * et le mot de passe, de la modale d'inscription qui s'ouvre par-dessus. Les
 * deux voyagent ensemble : c'est un seul geste pour le visiteur, et le compte
 * n'a de sens qu'avec le site qu'il vient de donner.
 */

const site = {
  url: z.string().trim().min(1, "Saisissez l'adresse de votre site.").max(2048),
  mapsUrl: z
    .string()
    .trim()
    .max(2048)
    .nullish()
    .transform((value) => (value ? value : null)),
  mode: z.enum(["physical", "online"]).default("physical"),
};

/** Inscription par e-mail depuis la modale : tout est saisi d'un coup. */
export const freeDemoSchema = z.object({
  ...site,
  email: z.email("Adresse e-mail invalide."),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
    ),
});
export type FreeDemoInput = z.infer<typeof freeDemoSchema>;

/**
 * Départ vers Google : il n'y a pas d'adresse à valider — Google la donnera —
 * mais le site, lui, doit être lisible avant qu'on quitte la page.
 */
export const rememberDemoSchema = z.object(site);
export type RememberDemoInput = z.infer<typeof rememberDemoSchema>;
