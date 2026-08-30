/**
 * Crée (ou remet à niveau) un compte abonné pour tester la version payante.
 *
 *   node scripts/create-subscriber.mjs [email] [motdepasse]
 *
 * Le compte reçoit `plan = "pro"` et un abonnement `active` valable un an :
 * `isReportUnlocked()` ouvre alors tous les rapports, sans passer par Stripe.
 * Le mot de passe est haché avec la même fonction que Better Auth
 * (`better-auth/crypto`), de sorte que la connexion par e-mail/mot de passe
 * fonctionne exactement comme pour un compte créé depuis le formulaire.
 *
 * Idempotent : relancer le script met simplement le compte à jour.
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const email = (process.argv[2] ?? "abonne@got-the-ref.test").toLowerCase();
const password = process.argv[3] ?? "AbonneTest2026!";
const name = "Compte abonné (test)";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL manquant : renseignez-le dans .env avant de lancer le script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");

  // 1. Utilisateur — plan payant, e-mail considéré comme vérifié.
  const existing = await client.query('SELECT id FROM "User" WHERE email = $1', [email]);
  let userId = existing.rows[0]?.id;

  if (userId) {
    await client.query(
      'UPDATE "User" SET plan = $2, "emailVerified" = true, name = $3, "updatedAt" = now() WHERE id = $1',
      [userId, "pro", name],
    );
    console.log(`Utilisateur existant mis à niveau : ${email}`);
  } else {
    userId = randomUUID();
    await client.query(
      `INSERT INTO "User" (id, email, name, "emailVerified", plan, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, 'pro', now(), now())`,
      [userId, email, name],
    );
    console.log(`Utilisateur créé : ${email}`);
  }

  // 2. Identifiants e-mail/mot de passe (provider « credential » de Better Auth).
  const hash = await hashPassword(password);
  const account = await client.query(
    `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId],
  );
  if (account.rows[0]?.id) {
    await client.query('UPDATE account SET password = $2, "updatedAt" = now() WHERE id = $1', [
      account.rows[0].id,
      hash,
    ]);
  } else {
    await client.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), userId, hash],
    );
  }

  // 3. Abonnement actif d'un an — aucun aller-retour Stripe nécessaire.
  const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const sub = await client.query('SELECT id FROM "Subscription" WHERE "userId" = $1', [userId]);
  if (sub.rows[0]?.id) {
    await client.query(
      `UPDATE "Subscription" SET status = 'active', "currentPeriodEnd" = $2, "updatedAt" = now()
       WHERE id = $1`,
      [sub.rows[0].id, periodEnd],
    );
  } else {
    await client.query(
      `INSERT INTO "Subscription" (id, "userId", status, "currentPeriodEnd", "createdAt", "updatedAt")
       VALUES ($1, $2, 'active', $3, now(), now())`,
      [randomUUID(), userId, periodEnd],
    );
  }

  await client.query("COMMIT");

  console.log("\nCompte abonné prêt :");
  console.log(`  e-mail       : ${email}`);
  console.log(`  mot de passe : ${password}`);
  console.log(`  plan         : pro (abonnement actif jusqu'au ${periodEnd.toLocaleDateString("fr-FR")})`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Échec :", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
