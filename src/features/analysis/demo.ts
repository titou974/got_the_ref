import "server-only";

import { cookies, headers } from "next/headers";
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
 * qu'on lui vend. Désormais la modale de la page d'accueil est une vraie
 * inscription : Google, ou une adresse et un mot de passe. Le visiteur atterrit
 * sur le tableau de bord, l'écran d'attente y lance l'audit sous ses yeux, et
 * les voiles du niveau gratuit lui montrent la forme exacte de ce qu'il n'a pas
 * encore payé.
 *
 * Ce compte n'ouvre aucun droit de plus qu'un compte gratuit ordinaire, et il
 * consomme l'essai : c'est une démonstration reçue, pas une promesse à venir
 * (cf. `getTrialState`).
 */

/** Ce que le visiteur a saisi avant de s'identifier, une fois validé. */
export type DemoSite = {
  /** L'adresse du site, normalisée. */
  url: string;
  domain: string;
  mode: BusinessMode;
  mapsUrl: string | null;
};

export type DemoSiteFailure =
  | { ok: false; reason: "invalid_url" }
  | { ok: false; reason: "invalid_maps_url" }
  | { ok: false; reason: "blocked_url"; detail: string };

export type FreeDemoOutcome =
  | { ok: true; userId: string; domain: string }
  /** L'adresse appartient déjà à un compte : c'est une connexion qu'il faut. */
  | { ok: false; reason: "existing_account" }
  | { ok: false; reason: "no_email" }
  | { ok: false; reason: "failed" }
  | DemoSiteFailure;

/**
 * Valide ce que le visiteur a tapé avant qu'on écrive quoi que ce soit.
 *
 * Sortie en amont de l'inscription, et pas seulement pour l'ordre des messages
 * d'erreur : le parcours Google quitte la page pour de bon, et une adresse
 * invalide découverte au retour laisserait un compte ouvert sur un site qu'on
 * ne sait pas lire.
 */
export async function validateDemoSite(params: {
  rawUrl: string;
  rawMapsUrl?: string | null;
  mode?: BusinessMode;
}): Promise<{ ok: true; site: DemoSite } | DemoSiteFailure> {
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

  return { ok: true, site: { url, domain, mode, mapsUrl } };
}

/**
 * Remplit la fiche d'accueil avec ce que le visiteur vient de saisir, et la
 * marque terminée.
 *
 * Sans ça, la coque du tableau de bord le renverrait sur le questionnaire de
 * mise en route, et on lui redemanderait les deux réponses qu'il vient de
 * donner. L'audit, lui, n'est pas lancé ici : c'est l'écran d'attente du
 * tableau de bord qui s'en charge (`prepareDashboardAction`). C'est ce qui fait
 * la démonstration — le client voit l'analyse tourner sur son propre site, à la
 * bonne profondeur pour son niveau, plutôt qu'un rapport déjà figé.
 */
async function seedOnboarding(userId: string, site: DemoSite): Promise<void> {
  const fields = {
    businessKind: site.mode,
    siteUrl: site.url,
    domain: site.domain,
    mapsUrl: site.mapsUrl,
    step: LAST_STEP,
    completedAt: new Date(),
  };

  await prisma.onboardingProfile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  });
}

/**
 * Ouvre le compte gratuit à partir d'une adresse et d'un mot de passe, puis
 * renseigne sa fiche d'accueil.
 *
 * ## Ce que la fonction refuse de faire
 *
 * Elle n'ouvre pas de session sur une adresse déjà connue. Un e-mail tapé dans
 * un champ public n'est pas une preuve d'identité, et le mot de passe saisi
 * dans cette modale est celui d'une inscription, pas d'une connexion : le
 * vérifier ici ferait de la page d'accueil un banc d'essai de mots de passe.
 * Ces visiteurs-là sont renvoyés vers la connexion, en toutes lettres.
 */
export async function startFreeDashboardDemo(params: {
  rawUrl: string;
  rawMapsUrl?: string | null;
  rawEmail?: string | null;
  password: string;
  mode?: BusinessMode;
}): Promise<FreeDemoOutcome> {
  const email = normalizeEmail(params.rawEmail);
  if (!email) return { ok: false, reason: "no_email" };

  const validated = await validateDemoSite(params);
  if (!validated.ok) return validated;
  const { site } = validated;

  // L'adresse est-elle déjà celle d'un compte ? La question se pose avant toute
  // écriture : la réponse renvoie le visiteur sur la connexion, sans qu'on ait
  // touché à son compte ni à sa fiche.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, reason: "existing_account" };

  // La liste de diffusion d'abord : c'est elle qui dira, au moment de la
  // création du compte, quel message expédier — la confirmation de l'analyse
  // plutôt que la bienvenue générique (cf. `better-auth.config`).
  try {
    await captureLead({ email, domain: site.domain, source: FREE_DEMO_SOURCE });
  } catch (err) {
    console.error("Enregistrement du lead échoué :", err);
  }

  let userId: string;
  try {
    const { user } = await auth.api.signUpEmail({
      body: { email, password: params.password, name: email.split("@")[0] },
      headers: await headers(),
    });
    userId = user.id;
  } catch (err) {
    console.error("Ouverture du compte de démonstration échouée :", err);
    return { ok: false, reason: "failed" };
  }

  try {
    await seedOnboarding(userId, site);
  } catch (err) {
    console.error("Fiche d'accueil de la démonstration non enregistrée :", err);
    return { ok: false, reason: "failed" };
  }

  return { ok: true, userId, domain: site.domain };
}

/* -------------------------------------------------------------------------- */
/*                        Le détour par Google                                 */
/* -------------------------------------------------------------------------- */

/**
 * Le site en attente, mis de côté le temps d'un aller-retour chez Google.
 *
 * L'inscription Google quitte la page : l'adresse du site, la forme du commerce
 * et la fiche Maps ne survivent pas au voyage. On les dépose donc dans un
 * cookie avant de partir, et on les reprend au retour, sur `/bienvenue`.
 *
 * `httpOnly` : le contenu n'a rien à faire dans du code de page, et un script
 * tiers ne doit pas pouvoir décider quel site sera rattaché au compte qui vient
 * de naître. Durée courte — c'est le temps d'un consentement Google, pas d'une
 * session.
 */
const PENDING_DEMO_COOKIE = "gottheref_demo_site";
const PENDING_DEMO_MAX_AGE = 30 * 60;

/** Met le site de côté avant d'envoyer le visiteur chez Google. */
export async function rememberPendingDemo(site: DemoSite): Promise<void> {
  const store = await cookies();
  store.set(PENDING_DEMO_COOKIE, JSON.stringify(site), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_DEMO_MAX_AGE,
  });
}

/** Le site mis de côté, ou `null` si le cookie est absent ou illisible. */
async function readPendingDemo(): Promise<DemoSite | null> {
  const raw = (await cookies()).get(PENDING_DEMO_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DemoSite>;
    if (typeof parsed.url !== "string" || typeof parsed.domain !== "string") return null;
    return {
      url: parsed.url,
      domain: parsed.domain,
      mode: parsed.mode === "online" ? "online" : "physical",
      mapsUrl: typeof parsed.mapsUrl === "string" ? parsed.mapsUrl : null,
    };
  } catch {
    return null;
  }
}

/**
 * Reprend le site mis de côté et l'attache au compte qui rentre de chez Google.
 *
 * Appelée à l'atterrissage de l'identification (`/bienvenue`), avant tout
 * aiguillage : c'est le seul moment où l'on sait à la fois qui vient d'entrer
 * et ce qu'il voulait faire analyser.
 *
 * Elle ne touche pas à une fiche déjà terminée. Un client qui a rempli son
 * questionnaire il y a six mois et qui reclique sur l'analyse de la page
 * d'accueil ne doit pas voir son domaine remplacé par celui qu'il vient de
 * taper — ce serait effacer son projet pour une curiosité de passage.
 *
 * Renvoie `true` si un site a bien été rattaché : c'est ce qui autorise à
 * déposer le visiteur directement sur son tableau de bord.
 */
export async function claimPendingDemo(userId: string, email: string): Promise<boolean> {
  const site = await readPendingDemo();
  if (!site) return false;

  // Jeton à usage unique : lu, il ne doit pas resservir au prochain passage.
  (await cookies()).delete(PENDING_DEMO_COOKIE);

  const profile = await prisma.onboardingProfile.findUnique({
    where: { userId },
    select: { completedAt: true },
  });
  if (profile?.completedAt) return false;

  try {
    await captureLead({ email, domain: site.domain, source: FREE_DEMO_SOURCE });
  } catch (err) {
    console.error("Enregistrement du lead échoué :", err);
  }

  await seedOnboarding(userId, site);
  return true;
}
