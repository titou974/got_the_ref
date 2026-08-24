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
import { analyzeSite, readTone, suggestCompetitors } from "./service";
import { ensureOnboardingProfile } from "./queries";
import { hasPhysicalPresence, nextStep, type OnboardingStep } from "./steps";

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
  "search-console",
] as const;

/** La plus avancée des deux étapes — celle enregistrée, ou celle qu'on quitte. */
function furthestStep(current: string, candidate: OnboardingStep): string {
  const currentIndex = ORDER.indexOf(current as OnboardingStep);
  const candidateIndex = ORDER.indexOf(candidate);
  return candidateIndex > currentIndex ? candidate : current;
}

/** Avance la fiche et emmène sur l'étape suivante. */
async function advance(userId: string, from: OnboardingStep, data: Record<string, unknown>) {
  const target = nextStep(from);
  const profile = await prisma.onboardingProfile.findUniqueOrThrow({
    where: { userId },
    select: { step: true },
  });

  await prisma.onboardingProfile.update({
    where: { userId },
    data: { ...data, step: target ? furthestStep(profile.step, target) : profile.step },
  });

  revalidatePath(ROUTES.onboarding);
  redirect(target ? ROUTES.onboardingStep(target) : ROUTES.account);
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
        throw new AppError(
          "Ce site n'est pas accessible depuis l'extérieur.",
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

// ── Étape 4 : l'activité, puis les concurrents ───────────────────────────────

/**
 * L'étape 4 fait d'une pierre deux coups : elle enregistre la description et,
 * dans la foulée, demande au modèle les cinq concurrents directs.
 *
 * Les chercher ici plutôt qu'au chargement de l'étape 5 évite un écran d'attente
 * de plus : le client vient d'écrire trois champs, l'appel se glisse dans le
 * temps qu'il met à relire ce qu'il a tapé.
 */
export const saveDescriptionAction = authActionClient
  .inputSchema(descriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const profile = await ensureOnboardingProfile(ctx.auth.user.id);

    await prisma.onboardingProfile.update({
      where: { userId: ctx.auth.user.id },
      data: parsedInput,
    });

    try {
      const competitors = await suggestCompetitors({
        siteUrl: profile.siteUrl,
        description: parsedInput.description,
        audience: parsedInput.audience,
        niche: parsedInput.niche,
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
    } catch (error) {
      console.error("[onboarding] concurrents introuvables", error);
    }

    await advance(ctx.auth.user.id, "description", {});
  });

/** Relance la recherche de concurrents depuis l'étape 5, si la liste déçoit. */
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
          selected: true,
        })),
        skipDuplicates: true,
      }),
    ]);

    revalidatePath(ROUTES.onboardingStep("concurrents"));
    return { count: competitors.length };
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

export const saveToneAction = authActionClient
  .inputSchema(toneSchema)
  .action(async ({ parsedInput, ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);

    let toneSummary: string | null = null;
    if (parsedInput.toneSampleUrl) {
      try {
        toneSummary = await readTone(parsedInput.toneSampleUrl);
      } catch (error) {
        // Étape facultative : un lien illisible ne bloque pas le tunnel.
        console.error("[onboarding] lecture de la tonalité impossible", error);
      }
    }

    await advance(ctx.auth.user.id, "tonalite", {
      brandColor: parsedInput.brandColor || null,
      toneSampleUrl: parsedInput.toneSampleUrl || null,
      toneSummary,
    });
  });

// ── Passer une étape · terminer ──────────────────────────────────────────────

const skipSchema = z.object({
  step: z.enum(["concurrents", "tonalite", "search-console"]),
});

/** Passe une étape facultative sans rien enregistrer. */
export const skipStepAction = authActionClient
  .inputSchema(skipSchema)
  .action(async ({ parsedInput, ctx }) => {
    await ensureOnboardingProfile(ctx.auth.user.id);
    await advance(ctx.auth.user.id, parsedInput.step, {});
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
      data: { completedAt: new Date(), step: "search-console" },
    });

    revalidatePath(ROUTES.account);
    redirect(ROUTES.account);
  });
