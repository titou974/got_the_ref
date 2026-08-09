import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, resolvePriceId, resolveCyclePriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { unlockAnalysisFromSession } from "@/features/billing/unlock";
import { BILLING_CYCLES, PAID_PLAN_KEYS, type PaidPlanKey } from "@/constants/plans";

export const runtime = "nodejs";

/**
 * Retrouve l'offre payante correspondant à un Price ID en résolvant le tarif de
 * chaque offre (l'env peut contenir un Product ID, d'où la résolution).
 */
async function planFromPriceId(priceId: string | undefined): Promise<PaidPlanKey | null> {
  if (!priceId) return null;

  // Mensuel et annuel sont deux tarifs du même abonnement : l'un comme l'autre
  // donne le plan « pro ». On les teste avant les offres historiques.
  for (const cycle of BILLING_CYCLES) {
    try {
      if ((await resolveCyclePriceId(cycle)) === priceId) return "pro";
    } catch {
      // env de cette formule absente : on ignore et on continue.
    }
  }

  for (const plan of PAID_PLAN_KEYS) {
    try {
      if ((await resolvePriceId(plan)) === priceId) return plan;
    } catch {
      // env d'une offre absente : on ignore et on continue.
    }
  }
  return null;
}

/** Valide qu'une valeur de metadata est bien une offre payante connue. */
function asPaidPlan(value: string | undefined): PaidPlanKey | null {
  return value && (PAID_PLAN_KEYS as readonly string[]).includes(value)
    ? (value as PaidPlanKey)
    : null;
}

async function syncSubscription(sub: Stripe.Subscription, userId?: string) {
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

  await prisma.subscription.upsert({
    where: { userId: resolvedUserId },
    create: {
      userId: resolvedUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      status: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      status: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });

  await prisma.user.update({
    where: { id: resolvedUserId },
    data: { plan: active && plan ? plan : "free" },
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Signature webhook invalide :", err);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, session.metadata?.userId);

          // Abonnement souscrit depuis un rapport : on le rattache et on l'ouvre,
          // même si le compte n'existe pas encore (il se crée juste après).
          if (session.metadata?.analysisId) {
            await unlockAnalysisFromSession(session);
          }
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          // Déblocage d'une analyse (tunnel principal) : le paiement porte sur
          // l'analyse, le compte peut être créé après.
          if (session.metadata?.analysisId) {
            await unlockAnalysisFromSession(session);
            break;
          }

          // Ancien flux transactionnel lié à un compte : on accorde l'offre.
          const plan = asPaidPlan(session.metadata?.plan);
          const customerId =
            typeof session.customer === "string" ? session.customer : session.customer?.id;
          const resolvedUserId =
            session.metadata?.userId ??
            (customerId
              ? (await prisma.user.findFirst({ where: { stripeCustomerId: customerId } }))?.id
              : undefined);
          if (resolvedUserId && plan) {
            await prisma.user.update({ where: { id: resolvedUserId }, data: { plan } });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
    }
  } catch (err) {
    console.error("Erreur traitement webhook :", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
