"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";
import { auth } from "@/features/auth/better-auth.config";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { unlockAnalysisFromSession } from "@/features/billing/unlock";
import { CLAIM_METADATA_KEY, claimMatches, clearClaim } from "@/features/billing/claim";
import { ROUTES } from "@/constants/routes";
import { postCheckoutSignUpSchema, signInSchema, signUpSchema } from "./schemas";

export const signUpAction = actionClient
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.signUpEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.password,
          name: parsedInput.name ?? parsedInput.email.split("@")[0],
        },
        headers: await headers(),
      });
    } catch {
      returnValidationErrors(signUpSchema, {
        _errors: ["Impossible de créer le compte. Cet e-mail est peut-être déjà utilisé."],
      });
    }

    redirect(ROUTES.account);
  });

export const signInAction = actionClient
  .inputSchema(signInSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.signInEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.password,
        },
        headers: await headers(),
      });
    } catch {
      returnValidationErrors(signInSchema, {
        _errors: ["E-mail ou mot de passe incorrect."],
      });
    }

    redirect(ROUTES.account);
  });

/**
 * Création du compte juste après le paiement d'une analyse.
 * L'e-mail est celui de la session Stripe : on ne le redemande pas, et le
 * paiement fait foi. Une fois le compte créé, l'analyse payée lui est rattachée
 * et l'utilisateur atterrit directement sur son rapport complet.
 */
export const createAccountAfterCheckoutAction = actionClient
  .inputSchema(postCheckoutSignUpSchema)
  .action(async ({ parsedInput }) => {
    const session = await getStripe().checkout.sessions.retrieve(parsedInput.sessionId);

    // Un essai peut ne rien encaisser au-delà des frais d'activation : la session
    // vaut engagement dès lors qu'elle n'est pas restée impayée.
    if (session.payment_status === "unpaid") {
      returnValidationErrors(postCheckoutSignUpSchema, {
        _errors: ["Ce paiement n'a pas été confirmé."],
      });
    }

    // Connaître l'identifiant de session ne suffit pas : il apparaît dans l'URL
    // de retour. Sans le cookie déposé à l'ouverture du paiement, on refuse —
    // sinon n'importe qui pourrait ouvrir un compte à l'e-mail du payeur.
    if (!(await claimMatches(session.metadata?.[CLAIM_METADATA_KEY]))) {
      returnValidationErrors(postCheckoutSignUpSchema, {
        _errors: [
          "Ce paiement ne peut pas être revendiqué depuis ce navigateur. Créez votre compte depuis celui qui a servi au paiement, ou connectez-vous.",
        ],
      });
    }

    const email = session.customer_details?.email;
    // L'analyse est facultative : l'essai peut aussi être souscrit depuis la
    // carte tarif, sans rapport à rattacher.
    const analysisId = session.metadata?.analysisId;
    if (!email) {
      returnValidationErrors(postCheckoutSignUpSchema, {
        _errors: ["Impossible de retrouver votre paiement. Contactez-nous."],
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Le compte existe déjà : on rattache l'analyse, s'il y en a une, et on
      // invite à se connecter.
      await unlockAnalysisFromSession(session);
      returnValidationErrors(postCheckoutSignUpSchema, {
        _errors: [
          "Un compte existe déjà avec cet e-mail. Connectez-vous pour retrouver votre abonnement.",
        ],
      });
    }

    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password: parsedInput.password,
          name: parsedInput.name ?? email.split("@")[0],
        },
        headers: await headers(),
      });
    } catch {
      returnValidationErrors(postCheckoutSignUpSchema, {
        _errors: ["Impossible de créer le compte. Réessayez ou contactez-nous."],
      });
    }

    // Rattache l'analyse payée au compte fraîchement créé, s'il y en a une.
    await unlockAnalysisFromSession(session);
    // Jeton à usage unique : il ne doit pas resservir.
    await clearClaim();

    // Souscription depuis un rapport : on y retourne. Depuis la carte tarif :
    // rien à ouvrir, l'espace client prend le relais.
    redirect(analysisId ? ROUTES.analysis(analysisId) : ROUTES.account);
  });

export const signOutAction = actionClient.action(async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Idempotent : on redirige même sans session active.
  }

  redirect(ROUTES.home);
});
