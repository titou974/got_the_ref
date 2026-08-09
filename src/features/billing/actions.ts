"use server";

import { redirect } from "next/navigation";
import { actionClient, authActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { getStripe, getCheckoutMode, resolvePriceId } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { analysisCheckoutSchema, checkoutSchema } from "./schemas";
import { ANALYSIS_CHECKOUT_KIND } from "./unlock";

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
    const price = await resolvePriceId(parsedInput.plan);
    const metadata = { userId: user.id, plan: parsedInput.plan };

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
 * Déblocage d'une analyse : paiement unique, **sans compte requis**.
 * C'est le cœur du tunnel — le visiteur lance une analyse gratuite, découvre
 * l'aperçu, paie, puis crée son compte au retour de Stripe.
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
      // Déjà payée : rien à facturer, on renvoie vers le rapport.
      return { url: `${SITE.url}${ROUTES.analysis(analysis.id)}` };
    }

    const user = await getCurrentUser();
    const stripe = getStripe();
    const price = await resolvePriceId("pro");
    const metadata = {
      kind: ANALYSIS_CHECKOUT_KIND,
      analysisId: analysis.id,
      domain: analysis.domain,
      ...(user ? { userId: user.id } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      // Connecté : on réutilise son client Stripe. Anonyme : Stripe crée le
      // client à la volée, ce qui nous donne l'e-mail pour la création de compte.
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_creation: "always" as const, customer_email: user?.email }),
      success_url: `${SITE.url}${ROUTES.checkoutSuccess}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE.url}${ROUTES.analysis(analysis.id)}?paiement=annule`,
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
