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
import { businessKindSchema, siteSchema } from "./schemas";
import { analyzeSite } from "./service";
import { ensureOnboardingProfile } from "./queries";
import { hasPhysicalPresence, LAST_STEP, nextStep } from "./steps";

/**
 * Première étape : la forme du commerce.
 *
 * Elle commande la suivante. Une adresse où l'on vous trouve, et l'étape du
 * site réclame la fiche Google Maps, le crawl cherche des villes et les
 * classements se relèvent sur une zone. Pas d'adresse, et rien de tout cela
 * n'est demandé ni cherché : poser la question une fois ici évite d'inventer
 * une localisation à un logiciel vendu dans toute la France.
 */
export const saveBusinessKindAction = authActionClient
  .inputSchema(businessKindSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await ensureOnboardingProfile(userId);

    await prisma.onboardingProfile.update({
      where: { userId },
      data: { businessKind: parsedInput.businessKind, step: nextStep("activite") ?? LAST_STEP },
    });

    revalidatePath(ROUTES.onboarding);
    redirect(ROUTES.onboardingStep(nextStep("activite") ?? LAST_STEP));
  });

/**
 * Deuxième étape : l'adresse du site, et la fiche Maps s'il y a une adresse.
 *
 * C'est l'étape la plus lourde du produit — le site est crawlé, chaque page
 * conservée en base, puis relue par le modèle pour en tirer la langue, le pays,
 * les villes, un résumé de l'offre et la niche — et c'est la dernière.
 * Les questions qui suivaient (marché, activité, concurrents, ton) sont
 * précisément ce que cette lecture répond ; ce qu'elle rate se corrige ensuite
 * dans les réglages, devant un tableau de bord déjà rempli.
 *
 * Un crawl qui échoue n'annule pas l'étape : on enregistre l'adresse et on
 * ouvre quand même le tableau de bord, qui relancera l'audit. Refuser l'adresse
 * parce que le crawler dort serait absurde pour le client.
 */
export const saveSiteAction = authActionClient
  .inputSchema(siteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    const profile = await ensureOnboardingProfile(userId);

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

    // Tout ce que la lecture a compris est écrit d'un coup, et le tunnel se
    // referme dans la même écriture : il n'y a plus d'étape suivante où poser
    // ces réponses à la main.
    await prisma.onboardingProfile.update({
      where: { userId },
      data: {
        siteUrl: parsedInput.siteUrl,
        domain,
        mapsUrl,
        detectedLanguage: detected?.language ?? null,
        detectedCountry: detected?.country ?? null,
        detectedCities: detected?.cities ?? [],
        siteSummary: detected?.summary ?? null,
        ...(detected?.cities?.length ? { cities: detected.cities } : {}),
        ...(detected?.suggestedNiche ? { niche: detected.suggestedNiche } : {}),
        ...(detected?.suggestedAudience ? { audience: detected.suggestedAudience } : {}),
        ...(detected?.summary && !profile.description ? { description: detected.summary } : {}),
        step: LAST_STEP,
        completedAt: new Date(),
      },
    });

    revalidatePath(ROUTES.onboarding);
    revalidatePath(ROUTES.dashboard);
    redirect(ROUTES.dashboard);
  });

/**
 * Referme le tunnel et ouvre le tableau de bord. `completedAt` est la seule
 * marque qui compte : tant qu'il est nul, les pages abonnées y ramènent.
 *
 * Elle reste là pour les fiches à demi remplies par l'ancien tunnel en six
 * étapes : leur site est déjà connu, il n'y a rien à leur redemander.
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
