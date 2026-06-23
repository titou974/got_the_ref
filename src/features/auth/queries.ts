import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/better-auth.config";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";

/** Session Better Auth ({ user, session }) ou null. Mémoïsée par requête. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Utilisateur courant (avec son abonnement) tel que stocké en base, ou null. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.user) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });
});

/** Exige un utilisateur connecté, sinon redirige vers la connexion. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.signIn);
  return user;
}
