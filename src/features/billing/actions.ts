"use server";

import { redirect } from "next/navigation";
import { authActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { getStripe, getPriceId } from "@/lib/stripe";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { checkoutSchema } from "./schemas";

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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getPriceId(parsedInput.plan), quantity: 1 }],
      success_url: `${SITE.url}${ROUTES.account}?checkout=success`,
      cancel_url: `${SITE.url}${ROUTES.pricing}?checkout=cancel`,
      metadata: { userId: user.id, plan: parsedInput.plan },
      subscription_data: { metadata: { userId: user.id, plan: parsedInput.plan } },
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
