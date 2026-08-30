import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, resolvePriceId } from "@/lib/stripe";
import { BILLING_CYCLES, PAID_PLAN_KEYS, type PaidPlanKey } from "@/constants/plans";
import { resolveSessionUserId } from "./unlock";

/**
 * Le rattachement d'un abonnement Stripe à un compte, en un seul endroit.
 *
 * Le webhook n'est pas le seul à en avoir besoin : un abonnement se souscrit
 * sans compte (cf. `createSubscriptionCheckoutAction`), et le compte n'existe
 * qu'au retour de Stripe. L'événement `checkout.session.completed` arrive alors
 * avant l'inscription, sans rien à quoi se raccrocher — c'est la création de
 * compte qui doit rejouer le rattachement. D'où ce module, appelé des deux
 * côtés plutôt que recopié dans la route du webhook.
 */

/**
 * Retrouve l'offre payante correspondant à un Price ID en résolvant le tarif de
 * chaque offre (l'env peut contenir un Product ID, d'où la résolution).
 *
 * Chaque offre est testée sur ses deux cycles : un abonnement annuel porte un
 * price différent du mensuel, et sans ça il ne serait rattaché à aucune offre —
 * l'abonné retomberait en `free` au premier événement Stripe.
 */
async function planFromPriceId(priceId: string | undefined): Promise<PaidPlanKey | null> {
  if (!priceId) return null;

  for (const plan of PAID_PLAN_KEYS) {
    for (const cycle of BILLING_CYCLES) {
      try {
        if ((await resolvePriceId(plan, cycle)) === priceId) return plan;
      } catch {
        // env d'un cycle absente : on ignore et on continue.
      }
    }
  }
  return null;
}

/** L'offre déjà portée par le compte est-elle un abonnement payant ? */
function isPaidPlan(plan: string | null | undefined): plan is PaidPlanKey {
  return plan != null && (PAID_PLAN_KEYS as readonly string[]).includes(plan);
}

/**
 * Écrit l'abonnement sur le compte : la ligne `Subscription`, le client Stripe
 * et l'offre affichée.
 *
 * `stripeCustomerId` est posé sur le compte et pas seulement sur l'abonnement :
 * c'est lui — et lui seul — qu'ouvre le portail de facturation. Un abonné qui
 * ne l'a pas ne peut ni changer sa carte ni résilier.
 */
export async function syncSubscription(
  sub: Stripe.Subscription,
  userId?: string | null,
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const resolvedUserId =
    userId ??
    (sub.metadata?.userId as string | undefined) ??
    (await prisma.user.findFirst({ where: { stripeCustomerId: customerId } }))?.id;

  if (!resolvedUserId) return;

  const priceId = sub.items.data[0]?.price.id;
  const plan = await planFromPriceId(priceId);
  const active = sub.status === "active" || sub.status === "trialing";
  const periodEnd = sub.items.data[0]?.current_period_end;

  const record = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };

  await prisma.subscription.upsert({
    where: { userId: resolvedUserId },
    create: { userId: resolvedUserId, ...record },
    update: record,
  });

  // L'offre du compte suit l'abonnement, à deux exceptions près. Un compte de
  // démonstration n'est jamais touché par Stripe : son accès est une décision
  // prise à la main, pas un encaissement. Et un abonnement qui s'arrête ne
  // reprend pas un Coup de Boost déjà réglé — le client retombe dessus, pas sur
  // le gratuit.
  const current = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { plan: true, boostGrantedAt: true },
  });

  if (active && !plan) {
    // Le tarif ne correspond à aucune offre connue : price tourné sans mettre à
    // jour l'env, ou client conservé sur un ancien tarif. L'accès est sauf —
    // `resolveTier` le lit sur la ligne `Subscription` — mais l'offre affichée
    // dirait « Gratuit » à un abonné qui paie. On garde donc l'offre payante en
    // place, et à défaut on retient l'abonnement mensuel.
    console.warn(`[stripe] price inconnu sur l'abonnement ${sub.id} : ${priceId ?? "—"}`);
  }

  const next =
    current?.plan === "demo"
      ? "demo"
      : active
        ? (plan ?? (isPaidPlan(current?.plan) ? current.plan : "pro"))
        : current?.boostGrantedAt
          ? "boost"
          : "free";

  await prisma.user.update({
    where: { id: resolvedUserId },
    data: { plan: next, stripeCustomerId: customerId },
  });
}

/**
 * Rattache l'abonnement ouvert par une session de paiement.
 *
 * Sans effet sur une session qui n'ouvre pas d'abonnement, ou dont on ne sait
 * pas encore à quel compte la rattacher : l'appelant peut donc l'invoquer sans
 * trier lui-même. C'est ce qui permet de la rejouer à l'inscription, quand le
 * webhook est passé avant que le compte n'existe.
 */
export async function syncSubscriptionFromSession(
  session: Stripe.Checkout.Session,
  knownUserId?: string | null,
): Promise<string | null> {
  if (session.mode !== "subscription" || !session.subscription) return null;
  if (session.payment_status === "unpaid") return null;

  const userId = await resolveSessionUserId(session, knownUserId);
  if (!userId) return null;

  const subId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const sub = await getStripe().subscriptions.retrieve(subId);
  await syncSubscription(sub, userId);

  return userId;
}
