import "server-only";

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Jeton de revendication d'un paiement.
 *
 * L'identifiant de session Stripe voyage dans l'URL de retour : il finit dans
 * l'historique, les liens partagés, les journaux d'un proxy. Il ne peut donc pas
 * servir seul de preuve « c'est bien moi qui ai payé » pour créer un compte à
 * l'adresse e-mail du payeur. On dépose un jeton dans un cookie httpOnly au
 * moment d'ouvrir le paiement, on le recopie dans les métadonnées de la session,
 * et la création de compte n'est offerte qu'au navigateur qui présente les deux.
 */
export const CHECKOUT_CLAIM_COOKIE = "visia_checkout_claim";

/** Clé des métadonnées Stripe portant le jeton. */
export const CLAIM_METADATA_KEY = "claimToken";

/** Durée de vie du cookie : le temps d'un paiement, pas davantage. */
const MAX_AGE_SECONDS = 60 * 60 * 6;

export function newClaimToken(): string {
  return randomBytes(24).toString("hex");
}

export async function rememberClaim(token: string): Promise<void> {
  const store = await cookies();
  store.set(CHECKOUT_CLAIM_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Le navigateur courant est-il celui qui a ouvert ce paiement ? */
export async function claimMatches(expected: string | undefined | null): Promise<boolean> {
  if (!expected) return false;
  const presented = (await cookies()).get(CHECKOUT_CLAIM_COOKIE)?.value;
  if (!presented) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Jeton à usage unique : on l'efface dès que le compte est créé. */
export async function clearClaim(): Promise<void> {
  (await cookies()).delete(CHECKOUT_CLAIM_COOKIE);
}
