import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/** Marqueur porté par les sessions Stripe qui débloquent une analyse. */
export const ANALYSIS_CHECKOUT_KIND = "analysis_unlock";

/**
 * Marqueur des sessions ouvertes sans analyse : l'essai souscrit directement
 * depuis la carte tarif. Rien à débloquer — le paiement ouvre un compte, pas un
 * rapport — mais la session doit rester reconnaissable au retour de Stripe.
 */
export const TRIAL_CHECKOUT_KIND = "trial_start";

/**
 * Marqueur du « Coup de Boost » : un paiement unique, sans abonnement derrière.
 * Ouvert depuis un rapport, il le débloque comme n'importe quel paiement portant
 * un `analysisId` ; ouvert depuis la carte tarif, il n'ouvre qu'un compte.
 */
export const BOOST_CHECKOUT_KIND = "boost_one_shot";

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
  let ownerId = analysis.userId ?? identity.userId;
  if (!ownerId && identity.email) {
    const existing = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true },
    });
    ownerId = existing?.id ?? null;
  }

  // Conserve le client Stripe sur le compte, pour le portail de facturation.
  if (ownerId && identity.customerId) {
    await prisma.user.update({
      where: { id: ownerId },
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
