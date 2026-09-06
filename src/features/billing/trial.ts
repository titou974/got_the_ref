import "server-only";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { TRIAL, hasActiveSubscription, isTrialing } from "@/constants/plans";
import { resolveTier } from "@/constants/access";

/**
 * L'essai gratuit, et surtout ce qui l'arrête.
 *
 * L'essai est un abonnement Stripe ouvert en `trial_period_days` : la carte est
 * enregistrée, rien n'est débité, et le prélèvement tombe au troisième jour. Il
 * n'a donc pas de trace propre en base — son état, c'est le statut `trialing` de
 * la ligne `Subscription`.
 *
 * Ce qui suit règle la seule question que cet essai pose : que se passe-t-il
 * quand la personne achète pendant les trois jours ? Coup de Boost ou
 * abonnement pris au plein tarif, dans les deux cas l'essai n'a plus lieu
 * d'être et son prélèvement à venir non plus. On le résilie chez Stripe, tout
 * de suite : laisser courir un essai payerait 79 € trois jours après un achat
 * déjà réglé.
 */

/**
 * Résilie l'abonnement en essai d'un compte, s'il en a un.
 *
 * Immédiat et non facturé (`cancel`, pas `cancel_at_period_end`) : il n'y a rien
 * à laisser courir jusqu'au bout d'une période qui n'a jamais été payée.
 *
 * `exceptSubscriptionId` protège l'abonnement qu'on vient d'ouvrir : un client
 * qui prend l'abonnement pendant son essai crée un **second** abonnement chez
 * Stripe, et c'est l'ancien — celui qui est encore en essai — qu'il faut couper.
 * Sans cette garde, le webhook du nouvel abonnement résilierait le nouvel
 * abonnement si Stripe l'ouvrait lui aussi sur un essai.
 *
 * Sans effet si aucun essai ne court, si Stripe ne connaît pas l'abonnement, ou
 * s'il est déjà résilié : la fonction est appelée depuis le webhook comme depuis
 * la page de retour, pour un même achat.
 */
export async function cancelTrialingSubscription(
  userId: string,
  exceptSubscriptionId?: string | null,
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, stripeSubscriptionId: true },
  });

  if (!subscription || !isTrialing(subscription)) return false;

  const subId = subscription.stripeSubscriptionId;
  if (!subId || subId === exceptSubscriptionId) return false;

  try {
    await getStripe().subscriptions.cancel(subId);
  } catch (err) {
    // Déjà résilié chez Stripe, ou identifiant devenu inconnu : la ligne locale
    // doit quand même cesser d'annoncer un essai en cours.
    console.warn(`[stripe] résiliation de l'essai ${subId} impossible :`, err);
  }

  await prisma.subscription.updateMany({
    where: { userId, stripeSubscriptionId: subId },
    data: { status: "canceled" },
  });

  return true;
}

/** Ce que la page tarifs a besoin de savoir sur l'essai d'un visiteur. */
export type TrialState = {
  /** L'essai de trois jours est-il encore proposable à ce visiteur ? */
  available: boolean;
  /** Les trois jours courent-ils en ce moment ? */
  running: boolean;
  /** Durée de l'essai, en jours — pour les libellés. */
  days: number;
};

/** Ce qu'un visiteur sans compte voit : l'essai lui est ouvert. */
export const ANONYMOUS_TRIAL_STATE: TrialState = {
  available: true,
  running: false,
  days: TRIAL.days,
};

/**
 * L'essai est-il encore à prendre sur ce compte ?
 *
 * Non dès qu'un abonnement a été ouvert — en cours, en essai ou déjà résilié :
 * les trois jours ne se reprennent pas. Non non plus pour qui a déjà payé le
 * Coup de Boost ou reçu un accès de démonstration : leur proposer un essai
 * reviendrait à leur vendre moins que ce qu'ils ont.
 *
 * Et non, enfin, dès qu'une analyse a tourné sur ce compte. C'est la règle que
 * l'analyse gratuite de la page d'accueil rend nécessaire : elle ouvre un
 * compte et joue le produit en entier, voiles compris, sans rien débiter. La
 * démonstration a donc eu lieu — trois jours de plus ne montreraient rien de
 * neuf, et un compte pourrait la reprendre indéfiniment en relançant une
 * analyse. Passé ce point, ce sont les tarifs pleins, pour tout le monde.
 */
export async function getTrialState(userId: string): Promise<TrialState> {
  const [user, subscription, analyses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, boostGrantedAt: true },
    }),
    prisma.subscription.findUnique({ where: { userId }, select: { status: true } }),
    prisma.analysis.count({ where: { userId } }),
  ]);

  const running = isTrialing(subscription);
  const tier = resolveTier({
    plan: user?.plan,
    subscribed: hasActiveSubscription(subscription),
    boostGrantedAt: user?.boostGrantedAt,
  });

  return {
    available: subscription === null && tier === "free" && analyses === 0,
    running,
    days: TRIAL.days,
  };
}
