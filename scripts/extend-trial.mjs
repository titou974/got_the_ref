/**
 * Prolonge la période d'essai d'abonnements Stripe déjà en cours.
 *
 *   node scripts/extend-trial.mjs --list
 *   node scripts/extend-trial.mjs client@exemple.fr sub_123 cus_456
 *   node scripts/extend-trial.mjs client@exemple.fr --days=30 --apply
 *
 * Contre la production, chargez les variables de production plutôt que le `.env`
 * local (qui est en mode Test) :
 *
 *   vercel env pull .env.production
 *   node --env-file=.env.production scripts/extend-trial.mjs --list
 *
 * Le script ne modifie **rien** sans `--apply` : sans ce drapeau il affiche ce
 * qu'il ferait, ligne par ligne. C'est voulu — un `trial_end` mal posé encaisse
 * un client, ou lui offre un an.
 *
 * Options :
 *   --list          liste tous les abonnements en essai, sans rien changer.
 *   --days=N        durée du nouvel essai (défaut : 30).
 *   --from=now      point de départ : `now` (défaut) donne N jours à partir
 *                   d'aujourd'hui ; `trial-end` ajoute N jours à l'essai en cours.
 *   --apply         exécute réellement les mises à jour.
 *   --force         autorise un `trial_end` qui raccourcit l'essai en cours.
 *
 * Après la mise à jour, Stripe émet `customer.subscription.updated` : le webhook
 * de l'application resynchronise `Subscription.status` et `currentPeriodEnd`
 * tout seul. Rien à toucher en base.
 */

import "dotenv/config";
import Stripe from "stripe";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")));
const options = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--") && a.includes("="))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    }),
);
const targets = args.filter((a) => !a.startsWith("--"));

const LIST_ONLY = flags.has("--list");
const APPLY = flags.has("--apply");
const FORCE = flags.has("--force");
const DAYS = Number(options.days ?? 30);
const FROM = options.from ?? "now";

if (!Number.isFinite(DAYS) || DAYS <= 0) {
  console.error(`✗ --days=${options.days} invalide : attendu un nombre de jours positif.`);
  process.exit(1);
}
if (FROM !== "now" && FROM !== "trial-end") {
  console.error(`✗ --from=${FROM} invalide : attendu « now » ou « trial-end ».`);
  process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("✗ STRIPE_SECRET_KEY manquant dans l'environnement.");
  process.exit(1);
}

const mode = key.startsWith("sk_live_") ? "Live" : "Test";
const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });

const DAY = 24 * 60 * 60;
const fmt = (unix) =>
  unix
    ? new Date(unix * 1000).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : "—";

const customerEmail = (customer) =>
  typeof customer === "string" ? customer : (customer?.email ?? customer?.id ?? "—");

console.log(`Clé Stripe : mode ${mode}\n`);

// ── Listing ───────────────────────────────────────────────────────────────────

if (LIST_ONLY) {
  const subs = await stripe.subscriptions.list({
    status: "trialing",
    limit: 100,
    expand: ["data.customer"],
  });

  if (subs.data.length === 0) {
    console.log("Aucun abonnement en essai.");
    process.exit(0);
  }

  console.log(`${subs.data.length} abonnement(s) en essai :\n`);
  for (const sub of subs.data) {
    console.log(`  ${sub.id}`);
    console.log(`    client      : ${customerEmail(sub.customer)}`);
    console.log(`    tarif       : ${sub.items.data[0]?.price?.id ?? "—"}`);
    console.log(`    fin d'essai : ${fmt(sub.trial_end)}`);
    console.log("");
  }
  process.exit(0);
}

if (targets.length === 0) {
  console.error(
    "Usage : node scripts/extend-trial.mjs <email|sub_…|cus_…> [...] [--days=30] [--apply]\n" +
      "        node scripts/extend-trial.mjs --list",
  );
  process.exit(1);
}

// ── Résolution des cibles ─────────────────────────────────────────────────────

/** Tous les abonnements rattachés à un client Stripe. */
async function subscriptionsOfCustomer(customerId) {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  });
  return list.data;
}

/** Retrouve les clients Stripe portant cette adresse (liste puis recherche). */
async function customersByEmail(email) {
  const listed = await stripe.customers.list({ email, limit: 100 });
  if (listed.data.length > 0) return listed.data;

  // `list` filtre sur une correspondance exacte : la recherche rattrape les
  // différences de casse et les adresses saisies au checkout.
  try {
    const found = await stripe.customers.search({
      query: `email:'${email.replace(/'/g, "\\'")}'`,
      limit: 100,
    });
    return found.data;
  } catch {
    return [];
  }
}

/** Convertit un argument (email, sub_…, cus_…) en abonnements Stripe. */
async function resolveTarget(target) {
  if (target.startsWith("sub_")) {
    const sub = await stripe.subscriptions.retrieve(target, { expand: ["customer"] });
    return [sub];
  }
  if (target.startsWith("cus_")) {
    return subscriptionsOfCustomer(target);
  }

  const customers = await customersByEmail(target.toLowerCase());
  if (customers.length === 0) return [];

  const subs = [];
  for (const customer of customers) {
    subs.push(...(await subscriptionsOfCustomer(customer.id)));
  }
  return subs;
}

// ── Plan d'action ─────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);
const planned = [];
let refused = 0;

for (const target of targets) {
  let subs;
  try {
    subs = await resolveTarget(target);
  } catch (err) {
    console.log(`✗ ${target} — ${err.message}`);
    refused += 1;
    continue;
  }

  if (subs.length === 0) {
    console.log(`✗ ${target} — aucun abonnement trouvé.`);
    refused += 1;
    continue;
  }

  const trialing = subs.filter((s) => s.status === "trialing");
  const usable = trialing.length > 0 ? trialing : subs.filter((s) => s.status === "active");

  if (usable.length === 0) {
    console.log(
      `✗ ${target} — abonnement(s) trouvé(s) mais dans un état non prolongeable : ` +
        subs.map((s) => `${s.id} (${s.status})`).join(", "),
    );
    refused += 1;
    continue;
  }

  for (const sub of usable) {
    if (sub.status !== "trialing") {
      console.log(
        `⚠ ${target} — ${sub.id} est « ${sub.status} », pas « trialing ». ` +
          "Poser un trial_end sur un abonnement déjà facturé rouvre un essai : vérifiez avant --apply.",
      );
    }

    const base = FROM === "trial-end" && sub.trial_end ? sub.trial_end : now;
    const trialEnd = base + DAYS * DAY;

    if (sub.trial_end && trialEnd <= sub.trial_end && !FORCE) {
      console.log(
        `✗ ${target} — ${sub.id} : la nouvelle fin d'essai (${fmt(trialEnd)}) ` +
          `n'est pas postérieure à l'actuelle (${fmt(sub.trial_end)}). Ajoutez --force pour forcer.`,
      );
      refused += 1;
      continue;
    }

    planned.push({ target, sub, trialEnd });
  }
}

if (planned.length === 0) {
  console.error("\nRien à faire.");
  process.exit(refused > 0 ? 1 : 0);
}

console.log(`\n${APPLY ? "Mise à jour" : "Simulation (aucune écriture)"} — ${planned.length} abonnement(s) :\n`);

for (const { sub, trialEnd } of planned) {
  console.log(`  ${sub.id} · ${customerEmail(sub.customer)}`);
  console.log(`    ${fmt(sub.trial_end)}  →  ${fmt(trialEnd)}`);
}

if (!APPLY) {
  console.log("\nRelancez la même commande avec --apply pour l'exécuter.");
  process.exit(0);
}

// ── Exécution ─────────────────────────────────────────────────────────────────

console.log("");
let failed = 0;

for (const { sub, trialEnd } of planned) {
  try {
    const updated = await stripe.subscriptions.update(sub.id, {
      trial_end: trialEnd,
      // Le changement de fin d'essai ne doit rien facturer ni rembourser :
      // sans cela Stripe peut émettre une ligne de proratisation.
      proration_behavior: "none",
    });
    console.log(`✓ ${updated.id} — essai jusqu'au ${fmt(updated.trial_end)} (${updated.status})`);
  } catch (err) {
    console.log(`✗ ${sub.id} — ${err.message}`);
    failed += 1;
  }
}

console.log(
  "\nStripe émet « customer.subscription.updated » : le webhook resynchronise " +
    "Subscription.status et currentPeriodEnd en base, sans intervention.",
);

process.exitCode = failed > 0 || refused > 0 ? 1 : 0;
