"use server";

import { redirect } from "next/navigation";
import { actionClient, authActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { getStripe, getCheckoutMode, resolveBoostPriceId, resolvePriceId } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { TRIAL, type BillingCycle } from "@/constants/plans";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import {
  analysisCheckoutSchema,
  boostCheckoutSchema,
  checkoutSchema,
  subscriptionCheckoutSchema,
  trialCheckoutSchema,
} from "./schemas";
import {
  ANALYSIS_CHECKOUT_KIND,
  BOOST_CHECKOUT_KIND,
  SUBSCRIPTION_CHECKOUT_KIND,
} from "./unlock";
import { CLAIM_METADATA_KEY, newClaimToken, rememberClaim } from "./claim";

/**
 * Crée (ou réutilise) le client Stripe puis ouvre une session de paiement.
 * Renvoie l'URL Stripe Checkout : la redirection se fait côté client
 * (domaine externe, non gérable par `redirect()`).
 */
export const createCheckoutAction = authActionClient
  .inputSchema(checkoutSchema)
  .action(async ({ parsedInput, ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.auth.user.id },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });
    if (!user) throw new AppError("Utilisateur introuvable.", "USER_NOT_FOUND", 404);

    const stripe = getStripe();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const mode = getCheckoutMode(parsedInput.plan);
    const price = await resolvePriceId(parsedInput.plan, parsedInput.cycle);
    const metadata = { userId: user.id, plan: parsedInput.plan, cycle: parsedInput.cycle };

    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${SITE.url}${ROUTES.account}?checkout=success`,
      cancel_url: `${SITE.url}${ROUTES.pricing}?checkout=cancel`,
      metadata,
      // Propage l'identité de l'utilisateur sur l'objet adéquat selon le mode,
      // pour que le webhook retrouve le plan aussi bien en abonnement qu'en paiement unique.
      ...(mode === "subscription"
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new AppError("Le paiement est momentanément indisponible.", "STRIPE_NO_URL", 502);
    }

    return { url: session.url };
  });

/**
 * Souscription à l'abonnement got_the_ref depuis un rapport précis, **sans compte
 * requis**. C'est le cœur du tunnel : le visiteur lance une analyse gratuite,
 * lit le constat, s'abonne, puis crée son compte au retour de Stripe — le
 * rapport qui l'a amené là lui est rattaché au passage.
 */
export const createAnalysisCheckoutAction = actionClient
  .inputSchema(analysisCheckoutSchema)
  .action(async ({ parsedInput }) => {
    const analysis = await prisma.analysis.findUnique({
      where: { id: parsedInput.analysisId },
      select: { id: true, domain: true, unlocked: true },
    });
    if (!analysis) throw new AppError("Analyse introuvable.", "ANALYSIS_NOT_FOUND", 404);
    if (analysis.unlocked) {
      // Déjà ouverte : rien à facturer, on renvoie vers le rapport.
      return { url: `${SITE.url}${ROUTES.analysis(analysis.id)}` };
    }

    const user = await getCurrentUser();
    const stripe = getStripe();
    const cycle: BillingCycle = parsedInput.cycle;
    const price = await resolvePriceId("pro", cycle);

    // Lie le paiement au navigateur qui l'ouvre : l'identifiant de session Stripe
    // transite par l'URL de retour et ne suffit pas à prouver qu'on est le payeur.
    const claimToken = newClaimToken();
    await rememberClaim(claimToken);

    const metadata = {
      kind: ANALYSIS_CHECKOUT_KIND,
      analysisId: analysis.id,
      domain: analysis.domain,
      cycle,
      [CLAIM_METADATA_KEY]: claimToken,
      ...(user ? { userId: user.id } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // Connecté : on réutilise son client Stripe. Anonyme : Stripe crée le
      // client à la volée, ce qui nous donne l'e-mail pour la création de compte.
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user?.email }),
      success_url: `${SITE.url}${ROUTES.checkoutSuccess}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE.url}${ROUTES.analysis(analysis.id)}?paiement=annule`,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new AppError("Le paiement est momentanément indisponible.", "STRIPE_NO_URL", 502);
    }

    return { url: session.url };
  });

/**
 * Souscription à l'abonnement depuis la carte tarif, **sans compte ni analyse**.
 * C'est le chemin court : le visiteur clique sur le prix et arrive sur Stripe.
 *
 * Même montage que la souscription depuis un rapport, à ceci près qu'il n'y a
 * rien à débloquer au retour : la page de succès propose alors la création du
 * compte, puis l'espace client. Il n'y a plus d'essai — le compte gratuit tient
 * ce rôle, et il n'a besoin d'aucune carte bancaire.
 */
/**
 * Ouverture de l'essai de trois jours sur l'abonnement « Tout-en-un ».
 *
 * C'est le même checkout que la souscription, à `trial_period_days` près :
 * Stripe enregistre la carte, ne débite rien, et prélève le tarif du cycle
 * choisi au troisième jour si l'essai n'a pas été arrêté avant.
 *
 * Ce que l'essai ouvre côté produit n'est pas l'abonnement : le compte reste au
 * niveau gratuit — voiles compris — jusqu'au premier débit (cf.
 * `features/billing/access.ts`). L'essai montre le produit, il ne le donne pas.
 *
 * Le `kind` est celui de la souscription : au retour de Stripe, les deux se
 * traitent exactement pareil — un compte à ouvrir, aucun rapport à débloquer.
 */
export const createTrialCheckoutAction = actionClient
  .inputSchema(trialCheckoutSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    const stripe = getStripe();
    const cycle: BillingCycle = parsedInput.cycle;
    const price = await resolvePriceId("pro", cycle);

    // Lie le paiement au navigateur qui l'ouvre : l'identifiant de session Stripe
    // transite par l'URL de retour et ne suffit pas à prouver qu'on est le payeur.
    const claimToken = newClaimToken();
    await rememberClaim(claimToken);

    const metadata = {
      kind: SUBSCRIPTION_CHECKOUT_KIND,
      cycle,
      [CLAIM_METADATA_KEY]: claimToken,
      ...(user ? { userId: user.id } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user?.email }),
      success_url: `${SITE.url}${ROUTES.checkoutSuccess}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE.url}${ROUTES.pricing}?checkout=cancel`,
      metadata,
      subscription_data: { metadata, trial_period_days: TRIAL.days },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new AppError("Le paiement est momentanément indisponible.", "STRIPE_NO_URL", 502);
    }

    return { url: session.url };
  });

export const createSubscriptionCheckoutAction = actionClient
  .inputSchema(subscriptionCheckoutSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    const stripe = getStripe();
    const cycle: BillingCycle = parsedInput.cycle;
    const price = await resolvePriceId("pro", cycle);

    // Lie le paiement au navigateur qui l'ouvre : l'identifiant de session Stripe
    // transite par l'URL de retour et ne suffit pas à prouver qu'on est le payeur.
    const claimToken = newClaimToken();
    await rememberClaim(claimToken);

    const metadata = {
      kind: SUBSCRIPTION_CHECKOUT_KIND,
      cycle,
      [CLAIM_METADATA_KEY]: claimToken,
      ...(user ? { userId: user.id } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user?.email }),
      success_url: `${SITE.url}${ROUTES.checkoutSuccess}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE.url}${ROUTES.pricing}?checkout=cancel`,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new AppError("Le paiement est momentanément indisponible.", "STRIPE_NO_URL", 502);
    }

    return { url: session.url };
  });

/**
 * « Coup de Boost » : le paiement unique. Une passe complète des agents, réglée
 * en une fois — donc `mode: "payment"`, pas d'essai, pas d'abonnement créé
 * derrière, rien à résilier.
 *
 * Ouvert depuis un rapport, le `analysisId` voyage dans les metadata : le
 * webhook et la page de retour débloquent alors ce rapport comme pour n'importe
 * quel paiement (cf. `unlockAnalysisFromSession`). Ouvert depuis la carte tarif,
 * il n'y a rien à débloquer — le retour propose la création du compte.
 */
export const createBoostCheckoutAction = actionClient
  .inputSchema(boostCheckoutSchema)
  .action(async ({ parsedInput }) => {
    const analysis = parsedInput.analysisId
      ? await prisma.analysis.findUnique({
          where: { id: parsedInput.analysisId },
          select: { id: true, domain: true, unlocked: true },
        })
      : null;
    if (parsedInput.analysisId && !analysis) {
      throw new AppError("Analyse introuvable.", "ANALYSIS_NOT_FOUND", 404);
    }

    const user = await getCurrentUser();
    const stripe = getStripe();
    const price = await resolveBoostPriceId();

    // Lie le paiement au navigateur qui l'ouvre : l'identifiant de session Stripe
    // transite par l'URL de retour et ne suffit pas à prouver qu'on est le payeur.
    const claimToken = newClaimToken();
    await rememberClaim(claimToken);

    const metadata = {
      kind: BOOST_CHECKOUT_KIND,
      [CLAIM_METADATA_KEY]: claimToken,
      ...(analysis ? { analysisId: analysis.id, domain: analysis.domain } : {}),
      ...(user ? { userId: user.id } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user?.email }),
      success_url: `${SITE.url}${ROUTES.checkoutSuccess}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: analysis
        ? `${SITE.url}${ROUTES.analysis(analysis.id)}?paiement=annule`
        : `${SITE.url}${ROUTES.pricing}?checkout=cancel`,
      metadata,
      payment_intent_data: { metadata },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new AppError("Le paiement est momentanément indisponible.", "STRIPE_NO_URL", 502);
    }

    return { url: session.url };
  });

/**
 * Ouvre le portail de facturation Stripe.
 * Redirige directement vers l'URL Stripe (303).
 */
export const openBillingPortalAction = authActionClient.action(async ({ ctx }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.auth.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    redirect(ROUTES.pricing);
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${SITE.url}${ROUTES.account}`,
  });

  redirect(session.url);
});
