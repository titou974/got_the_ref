"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { BlockedUrlError } from "@/lib/geo/fetcher";
import { domainOf } from "@/lib/crawl/store";
import {
  businessKindSchema,
  competitorsSchema,
  descriptionSchema,
  marketSchema,
  siteSchema,
  toneSchema,
} from "./schemas";
import { analyzeSite, detectBrandTone, suggestCompetitors } from "./service";
import { ensureOnboardingProfile } from "./queries";
import { hasPhysicalPresence, LAST_STEP, nextStep, type OnboardingStep } from "./steps";

/**
 * Les actions du tunnel d'accueil. Chacune écrit son bloc de réponses, avance
 * `step`, puis renvoie sur l'étape suivante.
 *
 * `step` n'est avancé que vers l'avant (`furthestStep`) : revenir corriger
 * l'étape 2 ne doit pas reverrouiller les étapes déjà franchies.
 */

const ORDER = [
  "activite",
  "site",
  "marche",
  "description",
  "concurrents",
  "tonalite",
] as const;

/** La plus avancée des deux étapes — celle enregistrée, ou celle qu'on quitte. */
function furthestStep(current: string, candidate: OnboardingStep): string {
  const currentIndex = ORDER.indexOf(current as OnboardingStep);
  const candidateIndex = ORDER.indexOf(candidate);
  return candidateIndex > currentIndex ? candidate : current;
}

/**
 * Avance la fiche et emmène sur l'étape suivante.
 *
 * Quand il n'y a plus d'étape après celle-ci, c'est que le tunnel se referme :
 * on pose `completedAt` dans la même écriture et on ouvre le tableau de bord.
 * Sans cela, la dernière réponse laisserait la fiche éternellement inachevée et
 * les pages abonnées renverraient le client dans le tunnel qu'il vient de finir.
 */
async function advance(userId: string, from: OnboardingStep, data: Record<string, unknown>) {
  const target = nextStep(from);
  const profile = await prisma.onboardingProfile.findUniqueOrThrow({
    where: { userId },
    select: { step: true },
  });

  await prisma.onboardingProfile.update({
    where: { userId },
    data: target
      ? { ...data, step: furthestStep(profile.step, target) }
      : { ...data, step: LAST_STEP, completedAt: new Date() },
  });

  revalidatePath(ROUTES.onboarding);

  if (target) redirect(ROUTES.onboardingStep(target));

  revalidatePath(ROUTES.dashboard);
  redirect(ROUTES.dashboard);
}

// ── Étape 1 : la forme du commerce ───────────────────────────────────────────

export const saveBusinessKindAction = authActionClient
  .inputSchema(businessKindSchema)
  .action(async ({ parsedInput, ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);
    await advance(ctx.auth.user.id, "activite", { businessKind: parsedInput.businessKind });
  });

// ── Étape 2 : le site (crawl + lecture) ──────────────────────────────────────

/**
 * L'étape la plus lourde du tunnel : le site est crawlé, chaque page conservée
 * en base, puis relue par le modèle pour en tirer la langue, le pays et — pour
 * un commerce qui reçoit du public — les villes.
 *
 * Un crawl qui échoue n'annule pas l'étape : on enregistre l'adresse et on
 * laisse l'étape 3 poser les questions que la lecture aurait dû préremplir.
 * Refuser l'adresse parce que le crawler dort serait absurde pour le client.
 */
export const saveSiteAction = authActionClient
  .inputSchema(siteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const profile = await ensureOnboardingProfile(ctx.auth.user.id);

    let domain: string;
    try {
      domain = domainOf(parsedInput.siteUrl);
    } catch {
      throw new AppError("Cette adresse ne ressemble pas à un site web.", "BAD_URL", 400);
    }

    const mapsUrl =
      hasPhysicalPresence(profile.businessKind) && parsedInput.mapsUrl
        ? parsedInput.mapsUrl
        : null;

    let detected: Awaited<ReturnType<typeof analyzeSite>> | null = null;
    try {
      detected = await analyzeSite({
        url: parsedInput.siteUrl,
        businessKind: profile.businessKind,
        mapsUrl,
      });
    } catch (error) {
      if (error instanceof BlockedUrlError) {
        // Le garde distingue déjà l'adresse introuvable de l'adresse interdite.
        // Écraser son message par une phrase unique enverrait quelqu'un qui a
        // simplement fait une faute de frappe chercher un problème de pare-feu.
        throw new AppError(
          error.message === "URL non autorisée"
            ? "Ce site n'est pas accessible depuis l'extérieur."
            : error.message,
          "BLOCKED_URL",
          400,
        );
      }
      console.error("[onboarding] lecture du site impossible", error);
    }

    await advance(ctx.auth.user.id, "site", {
      siteUrl: parsedInput.siteUrl,
      domain,
      mapsUrl,
      detectedLanguage: detected?.language ?? null,
      detectedCountry: detected?.country ?? null,
      detectedCities: detected?.cities ?? [],
      siteSummary: detected?.summary ?? null,
      // Les villes détectées servent de proposition à l'étape 3 ; le client
      // reste libre de les corriger avant de valider.
      ...(detected?.cities?.length ? { cities: detected.cities } : {}),
      ...(detected?.suggestedNiche ? { niche: detected.suggestedNiche } : {}),
      ...(detected?.suggestedAudience ? { audience: detected.suggestedAudience } : {}),
      ...(detected?.summary && !profile.description ? { description: detected.summary } : {}),
    });
  });

// ── Étape 3 : marché et villes ───────────────────────────────────────────────

export const saveMarketAction = authActionClient
  .inputSchema(marketSchema)
  .action(async ({ parsedInput, ctx }) => {
    const profile = await ensureOnboardingProfile(ctx.auth.user.id);
    const cities = hasPhysicalPresence(profile.businessKind)
      ? parsedInput.cities.filter(Boolean)
      : [];

    await advance(ctx.auth.user.id, "marche", {
      targetMarket: parsedInput.targetMarket,
      cities,
    });
  });

// ── Étape 4 : l'activité ─────────────────────────────────────────────────────

/**
 * L'étape 4 n'enregistre que la description, et rend la main aussitôt.
 *
 * La recherche de concurrents tenait auparavant dans ce même appel : le client
 * cliquait « Continuer » et attendait, bouton figé, qu'un modèle réponde. Deux
 * défauts. L'attente n'était annoncée nulle part, et le moindre échec — la
 * seconde de trop, un JSON de travers — était avalé ici même : l'étape 5
 * s'ouvrait vide sans que rien ne l'explique. La recherche part maintenant
 * depuis l'étape 5 elle-même, à l'arrivée, écran d'attente à l'appui.
 */
export const saveDescriptionAction = authActionClient
  .inputSchema(descriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);

    await prisma.onboardingProfile.update({
      where: { userId: ctx.auth.user.id },
      data: parsedInput,
    });

    await advance(ctx.auth.user.id, "description", {});
  });

/**
 * Cherche les concurrents et rend la liste obtenue.
 *
 * Appelée à l'ouverture de l'étape 5 quand rien n'est encore enregistré, et
 * rappelée par le bouton « Proposer une autre liste ». Elle renvoie les
 * concurrents plutôt qu'un simple compte : le formulaire les affiche alors sans
 * attendre un second aller-retour, `revalidatePath` ne servant qu'à remettre
 * d'accord le rendu serveur pour les visites suivantes.
 */
export const refreshCompetitorsAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const profile = await ensureOnboardingProfile(ctx.auth.user.id);

    const competitors = await suggestCompetitors({
      siteUrl: profile.siteUrl,
      description: profile.description,
      audience: profile.audience,
      niche: profile.niche,
      targetMarket: profile.targetMarket,
      cities: profile.cities,
      businessKind: profile.businessKind,
    });

    await prisma.$transaction([
      prisma.competitor.deleteMany({ where: { profileId: profile.id } }),
      prisma.competitor.createMany({
        data: competitors.map((competitor) => ({
          profileId: profile.id,
          name: competitor.name,
          url: competitor.url,
          domain: competitor.domain,
          reason: competitor.reason,
          rank: competitor.rank,
          // Tous cochés par défaut : le client retire, il n'a pas à
          // reconstituer une liste qu'on vient de lui proposer.
          selected: true,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Les identifiants viennent d'être créés : on les relit pour que le
    // formulaire coche et enregistre les bonnes lignes.
    const saved = await prisma.competitor.findMany({
      where: { profileId: profile.id },
      orderBy: { rank: "asc" },
      select: { id: true, name: true, url: true, domain: true, reason: true, selected: true },
    });

    revalidatePath(ROUTES.onboardingStep("concurrents"));
    return { competitors: saved };
  });

// ── Étape 5 : sélection des concurrents ──────────────────────────────────────

export const saveCompetitorsAction = authActionClient
  .inputSchema(competitorsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const profile = await ensureOnboardingProfile(ctx.auth.user.id);
    const kept = new Set(parsedInput.selected);

    await prisma.$transaction([
      prisma.competitor.updateMany({
        where: { profileId: profile.id },
        data: { selected: false },
      }),
      prisma.competitor.updateMany({
        where: { profileId: profile.id, id: { in: [...kept] } },
        data: { selected: true },
      }),
    ]);

    await advance(ctx.auth.user.id, "concurrents", {});
  });

// ── Étape 6 : la tonalité ────────────────────────────────────────────────────

/**
 * Relève la tonalité du client et rend les champs à enregistrer.
 *
 * L'étape reste facultative, mais elle ne repart plus les mains vides quand le
 * client n'a pas de lien à donner : on va chercher un de ses articles dans le
 * crawl déjà en base, et à défaut on lit sa page d'accueil. Un échec n'arrête
 * rien — sans consigne de ton, les agents écrivent comme avant.
 */
async function readToneFor(
  userId: string,
  sampleUrl: string | null,
): Promise<{ toneSampleUrl: string | null; toneSummary: string | null }> {
  const profile = await prisma.onboardingProfile.findUnique({
    where: { userId },
    select: { siteUrl: true },
  });

  try {
    const reading = await detectBrandTone({
      siteUrl: profile?.siteUrl ?? null,
      sampleUrl,
    });
    return {
      // On garde l'adresse réellement lue : c'est elle que l'écran de
      // tonalité réaffiche, et le client doit pouvoir la corriger s'il n'est
      // pas d'accord avec la page choisie.
      toneSampleUrl: sampleUrl || reading.sourceUrl,
      toneSummary: reading.tone,
    };
  } catch (error) {
    console.error("[onboarding] lecture de la tonalité impossible", error);
    return { toneSampleUrl: sampleUrl, toneSummary: null };
  }
}

export const saveToneAction = authActionClient
  .inputSchema(toneSchema)
  .action(async ({ parsedInput, ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);

    const tone = await readToneFor(ctx.auth.user.id, parsedInput.toneSampleUrl || null);

    await advance(ctx.auth.user.id, "tonalite", {
      brandColor: parsedInput.brandColor || null,
      ...tone,
    });
  });

// ── Passer une étape · terminer ──────────────────────────────────────────────

const skipSchema = z.object({
  step: z.enum(["concurrents", "tonalite"]),
});

/**
 * Passe une étape facultative.
 *
 * La tonalité fait exception : passer l'étape ne veut pas dire renoncer à la
 * voix du client, seulement qu'il n'a pas de lien à fournir. On la relève quand
 * même sur son site, puisque c'est justement ce qu'on sait faire sans lui.
 */
export const skipStepAction = authActionClient
  .inputSchema(skipSchema)
  .action(async ({ parsedInput, ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);

    const data =
      parsedInput.step === "tonalite"
        ? await readToneFor(ctx.auth.user.id, null)
        : {};

    await advance(ctx.auth.user.id, parsedInput.step, data);
  });

/**
 * Referme le tunnel et ouvre le tableau de bord. `completedAt` est la seule
 * marque qui compte : tant qu'il est nul, les pages abonnées y ramènent.
 */
export const completeOnboardingAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);
    await prisma.onboardingProfile.update({
      where: { userId: ctx.auth.user.id },
      data: { completedAt: new Date(), step: LAST_STEP },
    });

    revalidatePath(ROUTES.dashboard);
    redirect(ROUTES.dashboard);
  });
