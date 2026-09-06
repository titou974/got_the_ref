import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import {
  BOOST_CHECKOUT_KIND,
  grantBoostFromSession,
  unlockAnalysisFromSession,
} from "@/features/billing/unlock";
import { syncSubscription, syncSubscriptionFromSession } from "@/features/billing/subscription";
import { PAID_PLAN_KEYS, type PaidPlanKey } from "@/constants/plans";

export const runtime = "nodejs";

/** Valide qu'une valeur de metadata est bien une offre payante connue. */
function asPaidPlan(value: string | undefined): PaidPlanKey | null {
  return value && (PAID_PLAN_KEYS as readonly string[]).includes(value)
    ? (value as PaidPlanKey)
    : null;
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          // Le compte peut ne pas encore exister : l'abonnement se souscrit sans
          // inscription préalable. `syncSubscriptionFromSession` reste alors sans
          // effet, et c'est la création de compte qui rejoue le rattachement.
          await syncSubscriptionFromSession(session);

          // Abonnement souscrit depuis un rapport : on le rattache et on l'ouvre,
          // même si le compte n'existe pas encore (il se crée juste après).
          if (session.metadata?.analysisId) {
            await unlockAnalysisFromSession(session);
          }
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          // Déblocage d'une analyse (tunnel principal) : le paiement porte sur
          // l'analyse, le compte peut être créé après. Un Coup de Boost pris
          // depuis un rapport fait les deux — il ouvre le rapport ET l'offre.
          if (session.metadata?.analysisId) {
            const unlocked = await unlockAnalysisFromSession(session);
            await grantBoostFromSession(session, unlocked?.userId);
            break;
          }

          // Coup de Boost pris sans rapport : rien à ouvrir, mais l'offre est
          // posée sur le compte du payeur — c'est elle qui déverrouille la
          // structure et les articles. Sans compte encore créé, la page de
          // retour s'en chargera après l'inscription.
          if (await grantBoostFromSession(session)) break;
          if (session.metadata?.kind === BOOST_CHECKOUT_KIND) break;

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
