import "server-only";

/**
 * Point d'entrée historique de l'auth. La logique vit désormais dans
 * `@/features/auth` (Better Auth). On ré-exporte pour la compatibilité.
 */
export { getSession, getCurrentUser, requireUser } from "@/features/auth/queries";
export { auth } from "@/features/auth/better-auth.config";
