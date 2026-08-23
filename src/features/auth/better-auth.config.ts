import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/constants/site";

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
 * Pas d'envoi d'e-mail (pas de Resend) : la réinitialisation par e-mail est
 * désactivée tant qu'un fournisseur n'est pas branché.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
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
