import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { identify, type McpIdentity } from "./tokens";

/**
 * La plomberie commune aux routes de l'API MCP : identifier l'agent, borner son
 * débit, répondre en JSON.
 *
 * Ces routes ne sont pas appelées par un navigateur mais par un programme qui
 * tourne en boucle sur le poste d'un client. Deux conséquences : l'erreur doit
 * être lisible par une machine (un code, pas une page), et le débit doit être
 * borné — un agent qui part en boucle interrogerait la base indéfiniment.
 */

/** Appels autorisés par jeton et par fenêtre. */
const LIMIT = 120;
const WINDOW_MS = 60_000;

export function jsonError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

export type AgentContext = McpIdentity & { email: string };

/**
 * Exécute le traitement au nom de l'agent identifié, ou rend l'erreur qui va
 * bien. L'e-mail est relu ici : chaque route l'affiche ou le journalise, et
 * c'est ce que l'agent montre au client pour qu'il sache sur quel compte il
 * travaille.
 */
export async function withAgent(
  request: Request,
  handler: (context: AgentContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const identity = await identify(request);
  if (!identity) {
    return jsonError(
      "Jeton absent, expiré ou révoqué. Relance l'appairage avec got_the_ref_connexion.",
      "UNAUTHORIZED",
      401,
    );
  }

  if (!rateLimit(`mcp:${identity.tokenId}`, LIMIT, WINDOW_MS).ok) {
    return jsonError("Trop d'appels. Réessaie dans une minute.", "RATE_LIMITED", 429);
  }

  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { email: true },
  });
  if (!user) {
    return jsonError("Compte introuvable.", "UNKNOWN_ACCOUNT", 404);
  }

  return handler({ ...identity, email: user.email });
}

/** Débit des routes ouvertes (appairage), comptées par adresse. */
export function limitByIp(request: Request, key: string, limit: number, windowMs: number) {
  return rateLimit(`${key}:${clientIp(request)}`, limit, windowMs).ok;
}
