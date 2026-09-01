import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { SITE } from "@/constants/site";
import {
  RESET_PASSWORD_TOKEN_TTL_SECONDS,
  resetPasswordEmail,
  welcomeEmail,
} from "./emails";

/**
 * Google n'est branché que si les deux identifiants OAuth sont présents.
 * Sans eux, déclarer le fournisseur exposerait une route de rappel qui
 * échouerait au retour de Google : mieux vaut ne pas l'annoncer du tout, et
 * masquer le bouton côté interface (cf. `isGoogleAuthEnabled`).
 */
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/** Vrai si la connexion Google est utilisable (identifiants OAuth configurés). */
export const isGoogleAuthEnabled = Boolean(googleClientId && googleClientSecret);

/**
 * Configuration Better Auth (email + mot de passe, PostgreSQL via Prisma).
 * Les e-mails transactionnels partent par Resend (cf. `@/lib/email`).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
    /**
     * Un mot de passe réinitialisé l'est souvent parce qu'on soupçonne un
     * accès de trop : on ferme les autres sessions ouvertes, sinon celui qui
     * était entré y reste.
     */
    revokeSessionsOnPasswordReset: true,
    /**
     * L'envoi est différé après la réponse (`after`) plutôt qu'attendu :
     * l'appel à Resend prend le temps qu'il prend, et ce temps se lit dans la
     * durée de la réponse — de quoi distinguer une adresse connue d'une
     * inconnue. `after` garantit l'exécution même en serverless, là où un
     * simple `void` serait coupé avec l'instance.
     */
    sendResetPassword: async ({ user, url, token }) => {
      const { subject, html, text } = resetPasswordEmail({
        url,
        userName: user.name,
      });
      after(() =>
        sendEmail({
          to: user.email,
          subject,
          html,
          text,
          // Clé adossée au jeton, qui change à chaque demande : un double clic
          // sur « Recevoir le lien » n'expédie qu'un e-mail, deux demandes
          // distinctes en expédient bien deux. La fonder sur l'URL ne
          // marcherait pas — elle se termine par le `callbackURL`, identique
          // d'une demande à l'autre.
          idempotencyKey: `reset-password/${token}`,
        }),
      );
    },
  },
  socialProviders: isGoogleAuthEnabled
    ? {
        google: {
          clientId: googleClientId as string,
          clientSecret: googleClientSecret as string,
          // Le poste d'un commerce sert souvent à plusieurs comptes Google :
          // on demande lequel utiliser plutôt que d'enchaîner sur le dernier.
          prompt: "select_account",
        },
      }
    : undefined,
  /**
   * Un même e-mail arrivé d'abord par mot de passe puis par Google désigne la
   * même personne : on rattache le compte au lieu d'échouer. Google vérifie
   * l'adresse, la liaison est donc sûre.
   */
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  /**
   * L'e-mail de bienvenue, accroché à la création de l'utilisateur.
   *
   * Ce point-là, et pas le formulaire d'inscription : une inscription par
   * Google ne passe pas par `signUpAction`, elle arrive par la route de rappel
   * de Better Auth. Brancher l'envoi sur l'action aurait privé de bienvenue la
   * moitié des nouveaux comptes — et un rattachement de compte Google à un
   * compte existant, lui, ne crée pas d'utilisateur et n'en déclenche donc pas,
   * ce qui est exactement le comportement voulu.
   *
   * `after` plutôt qu'un `await` : la création du compte n'a pas à attendre
   * Resend, et un envoi qui échoue ne doit pas faire échouer l'inscription.
   */
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { subject, html, text } = welcomeEmail({ userName: user.name });
          after(() =>
            sendEmail({
              to: user.email,
              subject,
              html,
              text,
              // Un compte n'est créé qu'une fois : la clé n'a rien à
              // distinguer de plus que son identifiant.
              idempotencyKey: `welcome/${user.id}`,
            }),
          );
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  rateLimit: {
    enabled: true,
    window: 900,
    max: 10,
    storage: "memory",
  },
  advanced: {
    cookiePrefix: "visia",
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
  baseURL: SITE.url,
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
