"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";
import { auth } from "@/features/auth/better-auth.config";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { unlockAnalysisFromSession } from "@/features/billing/unlock";
import { CLAIM_METADATA_KEY, claimMatches, clearClaim } from "@/features/billing/claim";
import { PASSWORD_RESET_PARAM, ROUTES, safeNextPath } from "@/constants/routes";
import { SITE } from "@/constants/site";
import {
  postCheckoutSignUpSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

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

    // L'inscription ouvre sur les tarifs : c'est là qu'allait le visiteur venu
    // de la home. `safeNextPath` écarte toute destination hors application.
    redirect(safeNextPath(parsedInput.next, ROUTES.pricing));
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

    // Un client qui revient retrouve son compte, sauf s'il était en route vers
    // une autre page — les tarifs, le plus souvent.
    redirect(safeNextPath(parsedInput.next, ROUTES.account));
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

    // Le compte est ouvert : place au questionnaire d'accueil. C'est le moment
    // où le client est le plus disposé à répondre — il vient de payer, il
    // attend que quelque chose commence. Le rapport qu'il vient de débloquer
    // reste à sa place, retrouvable depuis son espace client une fois les sept
    // questions passées.
    redirect(ROUTES.onboarding);
  });

/**
 * Demande d'un lien de réinitialisation.
 *
 * La réponse est la même que l'adresse existe ou non : dire « aucun compte à
 * cette adresse » transformerait le formulaire en annuaire de clients. Les
 * échecs de Better Auth sont donc avalés, et l'envoi de l'e-mail est différé
 * (cf. `sendResetPassword`) pour que la durée de la réponse ne trahisse pas
 * davantage.
 *
 * Le débit est bridé ici et non par Better Auth : son limiteur agit sur son
 * gestionnaire HTTP, que l'appel direct à `auth.api` court-circuite.
 */
export const requestPasswordResetAction = actionClient
  .inputSchema(requestPasswordResetSchema)
  .action(async ({ parsedInput }) => {
    const email = parsedInput.email.trim().toLowerCase();
    const headerList = await headers();
    const ip =
      headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerList.get("x-real-ip") ??
      "unknown";

    // Deux verrous : l'un contre le balayage d'adresses depuis un même poste,
    // l'autre contre le harcèlement d'une boîte précise depuis plusieurs.
    const perIp = rateLimit(`reset-password:ip:${ip}`, 5, 15 * 60 * 1000);
    const perEmail = rateLimit(`reset-password:email:${email}`, 3, 60 * 60 * 1000);
    if (!perIp.ok || !perEmail.ok) {
      returnValidationErrors(requestPasswordResetSchema, {
        _errors: [
          "Trop de demandes en peu de temps. Patientez quelques minutes avant de réessayer.",
        ],
      });
    }

    try {
      await auth.api.requestPasswordReset({
        body: {
          email,
          redirectTo: `${SITE.url}${ROUTES.resetPassword}`,
        },
        headers: headerList,
      });
    } catch (e) {
      // Adresse inconnue, compte Google sans mot de passe, panne de Resend :
      // rien de tout cela ne doit se lire dans la réponse. On journalise pour
      // pouvoir enquêter, et on affiche la même confirmation.
      console.error("[auth] requestPasswordReset :", e);
    }

    return { sent: true };
  });

/**
 * Pose le nouveau mot de passe à partir du jeton reçu par e-mail.
 *
 * Pas de connexion automatique dans la foulée : Better Auth ferme au contraire
 * toutes les sessions (`revokeSessionsOnPasswordReset`). On renvoie donc vers
 * la connexion, où le nouveau mot de passe sert immédiatement.
 */
export const resetPasswordAction = actionClient
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.resetPassword({
        body: {
          token: parsedInput.token,
          newPassword: parsedInput.password,
        },
        headers: await headers(),
      });
    } catch {
      returnValidationErrors(resetPasswordSchema, {
        _errors: [
          "Ce lien n'est plus valable. Demandez-en un nouveau pour changer votre mot de passe.",
        ],
      });
    }

    redirect(`${ROUTES.signIn}?${PASSWORD_RESET_PARAM}=1`);
  });

export const signOutAction = actionClient.action(async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Idempotent : on redirige même sans session active.
  }

  redirect(ROUTES.home);
});
