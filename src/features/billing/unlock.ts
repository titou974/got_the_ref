import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { cancelTrialingSubscription } from "./trial";

/** Marqueur porté par les sessions Stripe qui débloquent une analyse. */
export const ANALYSIS_CHECKOUT_KIND = "analysis_unlock";

/**
 * Marqueur des sessions ouvertes sans analyse : l'abonnement souscrit
 * directement depuis la carte tarif. Rien à débloquer — le paiement ouvre un
 * compte, pas un rapport — mais la session doit rester reconnaissable au retour
 * de Stripe.
 *
 * La valeur historique (`trial_start`) est conservée telle quelle : elle est
 * inscrite dans les métadonnées des sessions déjà passées chez Stripe, et la
 * renommer ferait retomber ces retours-là dans le cas « paiement non
 * identifié ». Le nom de la constante, lui, dit ce que l'offre est devenue.
 */
export const SUBSCRIPTION_CHECKOUT_KIND = "trial_start";

/**
 * Marqueur du « Coup de Boost » : un paiement unique, sans abonnement derrière.
 * Ouvert depuis un rapport, il le débloque comme n'importe quel paiement portant
 * un `analysisId` ; ouvert depuis la carte tarif, il n'ouvre qu'un compte.
 */
export const BOOST_CHECKOUT_KIND = "boost_one_shot";

/**
 * Retrouve le compte derrière une session Stripe, dans l'ordre de fiabilité :
 * ce que l'appelant sait déjà, puis les métadonnées posées à l'ouverture du
 * paiement, puis le client Stripe, puis l'e-mail du payeur.
 *
 * Les deux derniers recours existent parce qu'un Coup de Boost s'achète sans
 * compte : le compte n'est créé qu'au retour, et c'est l'e-mail de la session
 * qui les relie.
 */
export async function resolveSessionUserId(
  session: Stripe.Checkout.Session,
  known?: string | null,
): Promise<string | null> {
  if (known) return known;

  const fromMetadata = session.metadata?.userId;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  if (customerId) {
    const byCustomer = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }

  const email = session.customer_details?.email;
  if (!email) return null;
  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return byEmail?.id ?? null;
}

/**
 * Inscrit le Coup de Boost sur le compte du payeur.
 *
 * L'offre n'ouvre aucun abonnement Stripe : sans cette trace sur le compte, le
 * client retomberait gratuit au rechargement suivant. On pose donc l'offre et
 * la date — la date, parce que c'est elle qui ouvre la semaine de rédaction
 * promise (cf. `BOOST_ARTICLE_WINDOW_DAYS`).
 *
 * Trois précautions, toutes issues du même constat : cette fonction est appelée
 * par le webhook, par la page de retour et par la création de compte, souvent
 * pour le même paiement.
 *
 *   — un abonné (ou un compte de démonstration) garde son offre : le Coup de
 *     Boost ne doit jamais rétrograder qui a déjà mieux ;
 *   — la date n'est posée qu'une fois, sinon chaque passage rouvrirait la
 *     semaine de rédaction ;
 *   — l'appel est sans effet sur une session qui n'est pas un Coup de Boost
 *     réglé, ce qui laisse l'appelant l'invoquer sans trier lui-même.
 *
 * Un Coup de Boost payé pendant l'essai y met fin : la personne a choisi la
 * passe unique, elle n'a pas à voir tomber le prélèvement de l'abonnement trois
 * jours plus tard.
 */
export async function grantBoostFromSession(
  session: Stripe.Checkout.Session,
  knownUserId?: string | null,
): Promise<string | null> {
  if (session.metadata?.kind !== BOOST_CHECKOUT_KIND) return null;
  if (session.payment_status === "unpaid") return null;

  const userId = await resolveSessionUserId(session, knownUserId);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, boostGrantedAt: true },
  });
  if (!user) return null;

  const keepsPlan = user.plan === "pro" || user.plan === "agency" || user.plan === "demo";
  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(keepsPlan ? {} : { plan: "boost" }),
      boostGrantedAt: user.boostGrantedAt ?? new Date(),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  });

  await cancelTrialingSubscription(userId);

  return userId;
}

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
