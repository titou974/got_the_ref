import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/** Marqueur porté par les sessions Stripe qui débloquent une analyse. */
export const ANALYSIS_CHECKOUT_KIND = "analysis_unlock";

/** Identifiants extraits d'une session Stripe réglée. */
type SessionIdentity = {
  analysisId: string;
  email: string | null;
  customerId: string | null;
  userId: string | null;
};

function readIdentity(session: Stripe.Checkout.Session): SessionIdentity | null {
  const analysisId = session.metadata?.analysisId;
  if (!analysisId) return null;

  return {
    analysisId,
    email: session.customer_details?.email ?? null,
    customerId:
      typeof session.customer === "string"
        ? session.customer
        : (session.customer?.id ?? null),
    userId: session.metadata?.userId || null,
  };
}

/**
 * Débloque définitivement une analyse à partir d'une session Stripe payée.
 * Idempotent : appelé à la fois par le webhook et par la page de retour, car
 * l'utilisateur revient souvent sur le site avant que le webhook n'arrive.
 *
 * Le paiement porte sur l'analyse, pas sur un compte : un visiteur anonyme paie,
 * puis crée son compte juste après (cf. `/paiement/succes`).
 */
export async function unlockAnalysisFromSession(
  session: Stripe.Checkout.Session,
): Promise<{ analysisId: string; email: string | null; userId: string | null } | null> {
  // Une souscription ouverte sur un essai peut n'exiger aucun encaissement
  // immédiat : la session est alors « no_payment_required » et vaut bien
  // engagement. On refuse seulement ce qui reste réellement impayé.
  if (session.payment_status === "unpaid") return null;

  const identity = readIdentity(session);
  if (!identity) return null;

  const analysis = await prisma.analysis.findUnique({
    where: { id: identity.analysisId },
    select: { id: true, userId: true, paidAt: true, guestEmail: true },
  });
  if (!analysis) return null;

  // Le payeur a-t-il déjà un compte ? Si oui, l'analyse lui est rattachée.
  // `identity.userId` vient de nos métadonnées (posées côté serveur pour un
  // visiteur connecté) : c'est la seule preuve d'identité fiable ici.
  let ownerId = analysis.userId ?? identity.userId;

  // L'e-mail, lui, est saisi librement dans le formulaire Stripe Checkout : il
  // désigne un compte, il ne le prouve pas. On s'en sert pour rattacher le
  // rapport payé (bénin : le payeur a payé pour ce rapport), jamais pour
  // toucher aux données de facturation d'un compte existant.
  const ownerProven = ownerId !== null;
  if (!ownerId && identity.email) {
    const existing = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true },
    });
    ownerId = existing?.id ?? null;
  }

  // Conserve le client Stripe sur le compte, pour le portail de facturation.
  // Sans preuve d'identité, on ne l'écrit que si le compte n'en a pas encore :
  // sinon, quiconque paie en saisissant l'e-mail d'un tiers redirigerait le
  // portail de facturation de ce tiers vers SON propre client Stripe.
  if (ownerId && identity.customerId) {
    await prisma.user.updateMany({
      where: ownerProven ? { id: ownerId } : { id: ownerId, stripeCustomerId: null },
      data: { stripeCustomerId: identity.customerId },
    });
  }

  await prisma.analysis.update({
    where: { id: analysis.id },
    data: {
      unlocked: true,
      paidAt: analysis.paidAt ?? new Date(),
      stripeSessionId: session.id,
      guestEmail: identity.email ?? analysis.guestEmail,
      userId: ownerId,
    },
  });

  return { analysisId: analysis.id, email: identity.email, userId: ownerId };
}
