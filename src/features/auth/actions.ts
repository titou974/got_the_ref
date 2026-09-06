"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";
import { auth } from "@/features/auth/better-auth.config";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { grantBoostFromSession, unlockAnalysisFromSession } from "@/features/billing/unlock";
import { syncSubscriptionFromSession } from "@/features/billing/subscription";
import { CLAIM_METADATA_KEY, claimMatches, clearClaim } from "@/features/billing/claim";
import { resolveAuthDestination } from "./destination";
import { PASSWORD_RESET_PARAM, ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import {
  postCheckoutSignUpSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

/**
 * L'adresse IP de l'appelant, telle que la voient les proxys en amont.
 * Sert de clé de limitation : elle est la seule chose qu'un visiteur non
 * identifié apporte avec lui.
 */
function requestIp(headerList: Headers): string {
  return (
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headerList.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Comment ce compte a-t-il été ouvert ? Rien s'il n'existe pas.
 *
 * Sert à répondre juste à quelqu'un qui s'inscrit avec une adresse déjà prise :
 * lui dire « connectez-vous » alors qu'il n'a jamais eu de mot de passe — son
 * compte est venu de Google — le renvoie sur un formulaire qu'il ne peut pas
 * remplir. Le nom du fournisseur change la phrase, et donc l'issue.
 */
async function existingAccountKinds(email: string): Promise<Set<string> | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { accounts: { select: { providerId: true } } },
  });
  if (!user) return null;
  return new Set(user.accounts.map((account) => account.providerId));
}

/**
 * L'inscription par e-mail.
 *
 * Le cas qui compte n'est pas le compte neuf, c'est l'adresse déjà connue. Un
 * commerçant qui s'est inscrit il y a trois semaines revient, retape son
 * adresse et son mot de passe habituel dans le formulaire d'inscription — parce
 * que c'est le bouton qu'il voit en premier — et se prenait un « impossible de
 * créer le compte » sans rien à faire ensuite. Il repartait.
 *
 * Trois issues, selon ce qu'on sait de lui :
 *
 * - Le mot de passe qu'il vient de taper est le bon : on le connecte. Ce n'est
 *   pas une faveur, c'est une authentification réussie — il a fourni exactement
 *   ce qu'exige le formulaire de connexion, sur le formulaire d'à côté.
 * - Son compte vient de Google : on le lui dit, et le bouton Google est juste
 *   au-dessus. Lui parler de mot de passe n'aurait aucun sens, il n'en a pas.
 * - Le mot de passe ne correspond pas : on le renvoie à la connexion et au
 *   mot de passe oublié, en nommant le problème.
 *
 * Le débit est bridé comme à la connexion, et pour la même raison : à partir du
 * moment où ce formulaire vérifie un mot de passe, il en devient un banc
 * d'essai. Sans ces deux verrous, il suffirait de passer par l'inscription pour
 * contourner ceux de `signInAction`.
 */
export const signUpAction = actionClient
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput }) => {
    const email = parsedInput.email.trim().toLowerCase();
    const headerList = await headers();

    const perIp = rateLimit(`sign-up:ip:${requestIp(headerList)}`, 20, 15 * 60 * 1000);
    const perEmail = rateLimit(`sign-up:email:${email}`, 10, 15 * 60 * 1000);
    if (!perIp.ok || !perEmail.ok) {
      returnValidationErrors(signUpSchema, {
        _errors: [
          "Trop de tentatives en peu de temps. Patientez quelques minutes avant de réessayer.",
        ],
      });
    }

    let userId: string;
    try {
      const { user } = await auth.api.signUpEmail({
        body: {
          email,
          password: parsedInput.password,
          name: parsedInput.name ?? email.split("@")[0],
        },
        headers: headerList,
      });
      userId = user.id;
    } catch {
      const kinds = await existingAccountKinds(email);

      if (!kinds) {
        returnValidationErrors(signUpSchema, {
          _errors: ["Impossible de créer le compte. Réessayez dans un instant."],
        });
      }

      // Le compte existe et porte un mot de passe : celui qui vient d'être tapé
      // est peut-être le bon, et dans ce cas il n'y a plus rien à demander.
      if (kinds.has("credential")) {
        // La redirection est sortie du `try` : `redirect` navigue en levant, et
        // l'attraper ici ferait passer une connexion réussie pour un échec.
        let signedInId: string | null = null;
        try {
          const { user } = await auth.api.signInEmail({
            body: { email, password: parsedInput.password },
            headers: headerList,
          });
          signedInId = user.id;
        } catch {
          /* mot de passe différent de celui du compte : dit juste en dessous */
        }

        if (signedInId) {
          redirect(await resolveAuthDestination(signedInId, parsedInput.next));
        }

        returnValidationErrors(signUpSchema, {
          _errors: [
            "Un compte existe déjà avec cet e-mail, et ce mot de passe ne correspond pas. Connectez-vous, ou demandez un nouveau mot de passe.",
          ],
        });
      }

      if (kinds.has("google")) {
        returnValidationErrors(signUpSchema, {
          _errors: [
            "Ce compte a été ouvert avec Google. Utilisez le bouton « Continuer avec Google » ci-dessus.",
          ],
        });
      }

      returnValidationErrors(signUpSchema, {
        _errors: ["Un compte existe déjà avec cet e-mail. Connectez-vous pour le retrouver."],
      });
    }

    // Un compte neuf n'a pas encore répondu à l'accueil : c'est là qu'il va, et
    // le tableau de bord l'attend au bout. Plus personne n'est déposé sur la
    // grille tarifaire à l'inscription — le compte gratuit montre le produit,
    // et l'offre se vend depuis le tableau de bord (cf. `destination.ts`).
    redirect(await resolveAuthDestination(userId, parsedInput.next));
  });

/**
 * La connexion par e-mail.
 *
 * Le débit est bridé ici et non par Better Auth, pour la même raison que la
 * demande de réinitialisation : son limiteur agit sur son gestionnaire HTTP,
 * que l'appel direct à `auth.api` court-circuite. Sans ce verrou, le formulaire
 * accepterait un nombre illimité de mots de passe sur une adresse connue.
 */
export const signInAction = actionClient
  .inputSchema(signInSchema)
  .action(async ({ parsedInput }) => {
    const email = parsedInput.email.trim().toLowerCase();
    const headerList = await headers();

    // Deux verrous : l'un contre le balayage d'adresses depuis un même poste,
    // l'autre contre l'essai en force d'un mot de passe sur une adresse précise.
    const perIp = rateLimit(`sign-in:ip:${requestIp(headerList)}`, 20, 15 * 60 * 1000);
    const perEmail = rateLimit(`sign-in:email:${email}`, 10, 15 * 60 * 1000);
    if (!perIp.ok || !perEmail.ok) {
      returnValidationErrors(signInSchema, {
        _errors: [
          "Trop de tentatives en peu de temps. Patientez quelques minutes avant de réessayer.",
        ],
      });
    }

    let userId: string;
    try {
      const { user } = await auth.api.signInEmail({
        body: { email, password: parsedInput.password },
        headers: headerList,
      });
      userId = user.id;
    } catch {
      returnValidationErrors(signInSchema, {
        _errors: ["E-mail ou mot de passe incorrect."],
      });
    }

    // Un client qui revient rentre chez lui : le tableau de bord, quelle que
    // soit son offre. `resolveAuthDestination` n'honore la page visée qu'une
    // fois l'accueil rempli — l'y renvoyer avant ouvrirait des écrans vides.
    redirect(await resolveAuthDestination(userId, parsedInput.next));
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

    // Rattache l'analyse payée au compte fraîchement créé, s'il y en a une, et
    // pose le Coup de Boost sur ce compte quand c'est lui qui vient d'être
    // réglé : le paiement a précédé l'inscription, l'offre doit la rattraper.
    const unlocked = await unlockAnalysisFromSession(session);
    await grantBoostFromSession(session, unlocked?.userId);
    // Et l'abonnement, quand c'est lui qui vient d'être souscrit : le webhook
    // est passé avant que ce compte n'existe, il n'avait donc personne à qui
    // rattacher l'abonnement. Sans ce rappel, un client qui paie ressortirait
    // avec une offre gratuite et un tableau de bord verrouillé.
    await syncSubscriptionFromSession(session, unlocked?.userId);
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

    // Deux verrous : l'un contre le balayage d'adresses depuis un même poste,
    // l'autre contre le harcèlement d'une boîte précise depuis plusieurs.
    const perIp = rateLimit(`reset-password:ip:${requestIp(headerList)}`, 5, 15 * 60 * 1000);
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
