"use server";

import { headers } from "next/headers";
import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";
import { rateLimit } from "@/lib/rate-limit";
import { FREE_DEMO_QUOTA } from "@/constants/plans";
import { ROUTES } from "@/constants/routes";
import {
  rememberPendingDemo,
  startFreeDashboardDemo,
  validateDemoSite,
} from "./demo";
import { freeDemoSchema, rememberDemoSchema } from "./schemas";

/**
 * L'inscription lancée depuis la modale de la page d'accueil.
 *
 * Une action serveur, et non la route d'analyse : le mot de passe ne transite
 * alors que dans le corps de la requête, comme partout ailleurs dans le
 * produit, et Better Auth peut déposer la session par `next/headers` — ce que
 * son greffon `nextCookies` ne garantit que sur ce chemin-là.
 *
 * Elle ne redirige pas elle-même : c'est le navigateur qui navigue, une fois
 * l'animation de la modale retirée. Renvoyer l'adresse plutôt que de lever une
 * redirection laisse aussi la modale afficher ses erreurs sans clignoter.
 */
export const startFreeDemoAction = actionClient
  .inputSchema(freeDemoSchema)
  .action(async ({ parsedInput }) => {
    if (!(await demoRateAllowed())) {
      returnValidationErrors(freeDemoSchema, { _errors: [RATE_LIMITED] });
    }

    const result = await startFreeDashboardDemo({
      rawUrl: parsedInput.url,
      rawMapsUrl: parsedInput.mapsUrl,
      rawEmail: parsedInput.email,
      password: parsedInput.password,
      mode: parsedInput.mode,
    });

    if (result.ok) return { redirect: ROUTES.dashboard };

    switch (result.reason) {
      case "existing_account":
        returnValidationErrors(freeDemoSchema, {
          email: {
            _errors: [
              "Un compte existe déjà avec cet e-mail. Connectez-vous pour lancer votre analyse.",
            ],
          },
        });
        break;
      case "invalid_url":
        returnValidationErrors(freeDemoSchema, {
          url: { _errors: ["Cette adresse ne ressemble pas à un site web."] },
        });
        break;
      case "invalid_maps_url":
        returnValidationErrors(freeDemoSchema, {
          mapsUrl: {
            _errors: [
              "Lien Google Maps invalide. Collez l'adresse de votre fiche Google Maps.",
            ],
          },
        });
        break;
      case "blocked_url":
        returnValidationErrors(freeDemoSchema, { url: { _errors: [result.detail] } });
        break;
      default:
        returnValidationErrors(freeDemoSchema, {
          _errors: ["L'analyse n'a pas pu démarrer. Réessayez dans un instant."],
        });
    }
  });

/**
 * Le départ vers Google : on met le site de côté, puis le navigateur s'en va.
 *
 * L'action ne lance pas l'identification — la redirection vers Google doit
 * partir du navigateur (cf. `GoogleAuthButton`). Elle ne fait que deux choses,
 * dans cet ordre : vérifier que le site est lisible, parce qu'un aller-retour
 * chez Google pour rien est un abandon assuré, et déposer le cookie que
 * `/bienvenue` reprendra au retour.
 */
export const rememberFreeDemoAction = actionClient
  .inputSchema(rememberDemoSchema)
  .action(async ({ parsedInput }) => {
    if (!(await demoRateAllowed())) {
      returnValidationErrors(rememberDemoSchema, { _errors: [RATE_LIMITED] });
    }

    const validated = await validateDemoSite({
      rawUrl: parsedInput.url,
      rawMapsUrl: parsedInput.mapsUrl,
      mode: parsedInput.mode,
    });

    if (!validated.ok) {
      switch (validated.reason) {
        case "invalid_maps_url":
          returnValidationErrors(rememberDemoSchema, {
            mapsUrl: {
              _errors: [
                "Lien Google Maps invalide. Collez l'adresse de votre fiche Google Maps.",
              ],
            },
          });
          break;
        case "blocked_url":
          returnValidationErrors(rememberDemoSchema, {
            url: { _errors: [validated.detail] },
          });
          break;
        default:
          returnValidationErrors(rememberDemoSchema, {
            url: { _errors: ["Cette adresse ne ressemble pas à un site web."] },
          });
      }
    }

    if (validated.ok) await rememberPendingDemo(validated.site);

    // Le retour de Google atterrit sur l'aiguillage, qui reprendra le site mis
    // de côté avant de décider où déposer le visiteur.
    return { callbackURL: ROUTES.afterAuth };
  });

/** Le message opposé quand le plafond est atteint, commun aux deux actions. */
const RATE_LIMITED =
  "Trop d'analyses ouvertes depuis cet appareil. Connectez-vous pour continuer.";

/**
 * Le plafond par adresse IP, consulté avant l'ouverture du compte.
 *
 * Cette modale crée un utilisateur à partir d'une adresse e-mail : sans
 * plafond, une boucle en ouvrirait autant qu'elle veut, et chaque compte coûte
 * un crawl et un audit. La fonction ne fait que répondre — chaque action pose
 * ensuite son refus sur son propre schéma, pour que le message atterrisse bien
 * dans le formulaire qui l'a déclenché.
 */
async function demoRateAllowed(): Promise<boolean> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  return rateLimit(`demo:${ip}`, FREE_DEMO_QUOTA.limit, FREE_DEMO_QUOTA.windowMs).ok;
}
