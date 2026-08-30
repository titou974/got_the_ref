"use server";

import { z } from "zod";
import { authActionClient } from "@/lib/safe-action";
import { AppError } from "@/lib/errors";
import { approveDevice, denyDevice, normalizeUserCode } from "./device";
import { revokeToken } from "./tokens";

/**
 * Les gestes que le client pose depuis son navigateur sur les agents appairés :
 * autoriser, refuser, couper.
 *
 * Tous passent par `authActionClient` — l'utilisateur vient de sa session, il
 * n'est jamais pris en entrée. Sans quoi le code d'appairage affiché sur un
 * écran de terminal suffirait à rattacher un agent au compte d'autrui.
 */

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(8)
    .max(12)
    .transform(normalizeUserCode)
    .refine((value) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value), {
      message: "Code d'appairage invalide.",
    }),
});

/** Le client confirme le code lu dans son terminal : l'agent reçoit sa clé. */
export const approveAgentAction = authActionClient
  .inputSchema(codeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const outcome = await approveDevice(parsedInput.code, ctx.auth.user.id);

    if (outcome === "unknown") {
      throw new AppError(
        "Ce code n'existe plus. Relance la connexion depuis ton agent pour en obtenir un nouveau.",
        "MCP_CODE_UNKNOWN",
        404,
      );
    }
    if (outcome === "already") {
      throw new AppError(
        "Ce code a déjà été utilisé. Relance la connexion depuis ton agent.",
        "MCP_CODE_USED",
        409,
      );
    }

    return { autorise: true };
  });

/** Le client refuse : l'agent recevra un refus à son prochain relevé. */
export const denyAgentAction = authActionClient
  .inputSchema(codeSchema)
  .action(async ({ parsedInput }) => {
    await denyDevice(parsedInput.code);
    return { refuse: true };
  });

/** Le client coupe l'accès d'un agent déjà appairé. */
export const revokeAgentAction = authActionClient
  .inputSchema(z.object({ tokenId: z.string().min(1).max(60) }))
  .action(async ({ parsedInput, ctx }) => {
    const done = await revokeToken(ctx.auth.user.id, parsedInput.tokenId);
    if (!done) {
      throw new AppError("Cet agent n'est plus rattaché au compte.", "MCP_TOKEN_GONE", 404);
    }
    return { revoque: true };
  });
