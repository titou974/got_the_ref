import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { betterAuth as betterAuthMiddleware } from "@next-safe-action/adapter-better-auth";
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/better-auth.config";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/constants/plans";
import { AppError } from "./errors";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof AppError) return e.message;
    console.error(e);
    return "Une erreur inattendue est survenue.";
  },
});

/**
 * Actions nécessitant un utilisateur connecté.
 * On utilise un `authorize` custom (redirect) plutôt que le `unauthorized()`
 * par défaut, pour éviter d'activer `experimental.authInterrupts`.
 * Le contexte expose `ctx.auth = { user, session }`.
 */
export const authActionClient = actionClient.use(
  betterAuthMiddleware(auth, {
    authorize: async ({ authData, next }) => {
      if (!authData) {
        redirect(ROUTES.signIn);
      }
      return next({ ctx: { auth: authData } });
    },
  }),
);

/** Actions réservées aux abonnés avec un abonnement actif. */
export const subscriberActionClient = actionClient.use(
  betterAuthMiddleware(auth, {
    authorize: async ({ authData, next }) => {
      if (!authData) {
        redirect(ROUTES.signIn);
      }

      const subscription = await prisma.subscription.findUnique({
        where: { userId: authData.user.id },
        select: { status: true },
      });

      const active =
        subscription !== null &&
        (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(
          subscription.status,
        );

      if (!active) {
        redirect(ROUTES.pricing);
      }

      return next({ ctx: { auth: authData } });
    },
  }),
);
