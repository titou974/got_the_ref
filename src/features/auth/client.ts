import { createAuthClient } from "better-auth/react";

/**
 * Client Better Auth (navigateur).
 *
 * Il ne sert qu'aux parcours qui exigent une redirection pilotée par le
 * navigateur — la connexion Google. L'e-mail et le mot de passe passent, eux,
 * par les server actions de `features/auth/actions.ts` : le mot de passe ne
 * transite alors que dans le corps de la requête, jamais dans du code client.
 *
 * `baseURL` reste implicite : l'API d'authentification vit sur la même origine
 * que l'application (`/api/auth`).
 */
export const authClient = createAuthClient();
