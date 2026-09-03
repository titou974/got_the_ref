import "server-only";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/features/auth/better-auth.config";
import { FREE_DEMO_SOURCE, captureLead, normalizeEmail } from "@/features/leads/service";
import { normalizeUrl, assertPublicUrl, BlockedUrlError } from "@/lib/geo/fetcher";
import { normalizeMapsUrl, InvalidMapsUrlError } from "@/lib/geo/maps";
import { domainOf } from "@/lib/crawl/store";
import { LAST_STEP } from "@/features/onboarding/steps";
import type { BusinessMode } from "@/lib/geo/types";

/**
 * La démonstration gratuite : l'analyse lancée depuis la page d'accueil ouvre
 * un compte, et c'est le tableau de bord qui la joue.
 *
 * Avant, ce formulaire produisait un rapport public à part — une page de plus,
 * avec ses propres voiles, que le client quittait sans jamais voir le produit
 * qu'on lui vend. Désormais l'adresse laissée dans la modale suffit à ouvrir un
 * compte gratuit : le visiteur atterrit sur le tableau de bord, l'écran
 * d'attente y lance l'audit sous ses yeux, et les voiles du niveau gratuit lui
 * montrent la forme exacte de ce qu'il n'a pas encore payé.
 *
 * Ce compte n'ouvre aucun droit de plus qu'un compte gratuit ordinaire, et il
 * consomme l'essai : c'est une démonstration reçue, pas une promesse à venir
 * (cf. `getTrialState`).
 *
 * ## Ce que la fonction refuse de faire
 *
 * Elle n'ouvre pas de session sur une adresse déjà connue. Un e-mail tapé dans
 * un champ public n'est pas une preuve d'identité : signer quelqu'un parce
 * qu'il connaît l'adresse d'un client reviendrait à donner son tableau de bord
 * à qui la devine. Ces visiteurs-là repartent donc sur l'ancien chemin — le
 * rapport public — et le message reçu leur dit par où rentrer chez eux.
 */

export type FreeDemoOutcome =
  | {
      ok: true;
      userId: string;
      domain: string;
      /**
       * Les `Set-Cookie` de la session ouverte, à recopier sur la réponse.
       *
       * Le greffon `nextCookies` les pose déjà par `next/headers`, mais il est
       * documenté pour les actions serveur ; ici l'appel vient d'une route. On
       * récupère donc les en-têtes en clair et on les repose nous-mêmes : une
       * session qui ne suit pas déposerait le visiteur sur un tableau de bord
       * qui le renverrait aussitôt à la connexion.
       */
      cookies: string[];
    }
  /** L'adresse appartient à un compte : on ne se connecte pas à sa place. */
  | { ok: false; reason: "existing_account" }
  /** Adresse e-mail absente ou mal formée : on ne crée rien. */
  | { ok: false; reason: "no_email" }
  | { ok: false; reason: "invalid_url" }
  | { ok: false; reason: "invalid_maps_url" }
  | { ok: false; reason: "blocked_url"; detail: string }
  | { ok: false; reason: "failed" };

/**
 * Le mot de passe du compte ouvert depuis la home.
 *
 * Il n'est jamais montré, et personne n'a à le connaître : la session part avec
 * l'inscription, et l'e-mail de confirmation renvoie sur « mot de passe
 * oublié » pour revenir depuis un autre appareil. Laisser le champ vide n'était
 * pas une option — Better Auth exige un mot de passe, et un mot de passe
 * prévisible ferait de chaque adresse connue une porte ouverte.
 */
function throwawayPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Ouvre le compte gratuit et le renseigne assez pour que le tableau de bord
 * s'affiche sans repasser par le tunnel d'accueil.
 *
 * La fiche d'accueil est remplie ici avec ce que le visiteur vient de saisir —
 * la forme du commerce, l'adresse du site, la fiche Maps — et marquée terminée.
 * Sans ça, la coque du tableau de bord le renverrait sur le questionnaire, et
 * on lui redemanderait les deux réponses qu'il vient de donner.
 *
 * L'audit, lui, n'est pas lancé ici : c'est l'écran d'attente du tableau de
 * bord qui s'en charge (`prepareDashboardAction`). C'est ce qui fait la
 * démonstration — le client voit l'analyse tourner sur son propre site, à la
 * bonne profondeur pour son niveau, plutôt qu'un rapport déjà figé.
 */
export async function startFreeDashboardDemo(params: {
  rawUrl: string;
  rawMapsUrl?: string | null;
  rawEmail?: string | null;
  mode?: BusinessMode;
}): Promise<FreeDemoOutcome> {
  const email = normalizeEmail(params.rawEmail);
  if (!email) return { ok: false, reason: "no_email" };

  const mode: BusinessMode = params.mode === "online" ? "online" : "physical";

  let url: string;
  let domain: string;
  try {
    url = normalizeUrl(params.rawUrl);
    domain = domainOf(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  let mapsUrl: string | null;
  try {
    mapsUrl = mode === "physical" ? normalizeMapsUrl(params.rawMapsUrl) : null;
  } catch (err) {
    if (err instanceof InvalidMapsUrlError) return { ok: false, reason: "invalid_maps_url" };
    throw err;
  }

  try {
    await assertPublicUrl(url);
  } catch (err) {
    const detail = err instanceof BlockedUrlError ? err.message : "URL non autorisée.";
    return { ok: false, reason: "blocked_url", detail };
  }

  // L'adresse est-elle déjà celle d'un compte ? La question se pose avant toute
  // écriture : la réponse renvoie le visiteur sur l'ancien chemin, sans qu'on
  // ait touché à son compte ni à sa fiche.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, reason: "existing_account" };

  // La liste de diffusion d'abord : c'est elle qui dira, au moment de la
  // création du compte, quel message expédier — la confirmation de l'analyse
  // plutôt que la bienvenue générique (cf. `better-auth.config`).
  try {
    await captureLead({ email, domain, source: FREE_DEMO_SOURCE });
  } catch (err) {
    console.error("Enregistrement du lead échoué :", err);
  }

  let userId: string;
  let cookies: string[];
  try {
    const { headers: outgoing, response } = await auth.api.signUpEmail({
      body: {
        email,
        password: throwawayPassword(),
        name: email.split("@")[0],
      },
      headers: await headers(),
      returnHeaders: true,
    });
    userId = response.user.id;
    cookies = outgoing.getSetCookie();
  } catch (err) {
    console.error("Ouverture du compte de démonstration échouée :", err);
    return { ok: false, reason: "failed" };
  }

  try {
    await prisma.onboardingProfile.upsert({
      where: { userId },
      create: {
        userId,
        businessKind: mode,
        siteUrl: url,
        domain,
        mapsUrl,
        step: LAST_STEP,
        completedAt: new Date(),
      },
      update: {
        businessKind: mode,
        siteUrl: url,
        domain,
        mapsUrl,
        step: LAST_STEP,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Fiche d'accueil de la démonstration non enregistrée :", err);
    return { ok: false, reason: "failed" };
  }

  return { ok: true, userId, domain, cookies };
}
