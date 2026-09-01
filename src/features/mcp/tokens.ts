import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Les jetons que portent les agents IA appairés au compte.
 *
 * Un jeton d'agent n'est pas une session : il vit dans un fichier de
 * configuration, sur le poste du client, et sert des semaines durant. On le
 * traite donc comme un mot de passe — le serveur n'en garde que l'empreinte, et
 * personne, pas même nous, ne peut le relire après l'avoir accordé.
 */

/** Préfixe visible du jeton : il rend l'objet reconnaissable dans un fichier. */
const PREFIX = "gtr_";

/** 32 octets d'aléa : de quoi rendre la recherche exhaustive sans objet. */
const BYTES = 32;

export type McpIdentity = {
  userId: string;
  tokenId: string;
  clientName: string;
};

/** L'empreinte stockée. SHA-256 suffit : le jeton est déjà un secret aléatoire. */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Accorde un jeton à un agent et rend sa valeur en clair — la seule et unique
 * fois où elle existe côté serveur.
 */
export async function mintToken(userId: string, clientName: string): Promise<string> {
  const token = `${PREFIX}${randomBytes(BYTES).toString("base64url")}`;
  await prisma.mcpToken.create({
    data: { userId, tokenHash: hash(token), clientName },
  });
  return token;
}

/**
 * Accorde la clé d'un agent et retire les clés du même agent restées
 * inutilisées.
 *
 * Une clé créée puis jamais employée est une commande que le client n'a pas
 * collée — il a fermé la modale, ou l'a rouverte pour en reprendre une. La
 * laisser vivre encombrerait la liste de ses agents d'entrées qui n'ont jamais
 * rien ouvert, et laisserait traîner autant d'accès valides.
 */
export async function mintAgentKey(userId: string, clientName: string): Promise<string> {
  await prisma.mcpToken.updateMany({
    where: { userId, clientName, revokedAt: null, lastUsedAt: null },
    data: { revokedAt: new Date() },
  });
  return mintToken(userId, clientName);
}

/** Le porteur lu dans l'en-tête `Authorization: Bearer …`, ou `null`. */
function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

/** Vrai si la chaîne a la forme d'une clé d'agent — sans dire si elle est valide. */
export function looksLikeToken(value: string): boolean {
  return value.startsWith(PREFIX) && value.length > PREFIX.length;
}

/**
 * Identifie l'agent derrière une clé en clair, ou rend `null`.
 *
 * La comparaison passe par `timingSafeEqual` sur les empreintes plutôt que par
 * l'égalité de deux chaînes : la recherche se fait bien par index (`tokenHash`
 * est unique), mais la vérification finale ne doit pas rendre son verdict plus
 * vite selon le nombre de caractères communs.
 *
 * `lastUsedAt` est écrit après la réponse : c'est une trace pour l'écran des
 * appareils du client, pas une donnée dont dépend la requête en cours.
 */
export async function identifyToken(raw: string | null): Promise<McpIdentity | null> {
  if (!raw || !looksLikeToken(raw)) return null;

  const digest = hash(raw);
  const record = await prisma.mcpToken.findUnique({
    where: { tokenHash: digest },
    select: { id: true, userId: true, clientName: true, revokedAt: true, tokenHash: true },
  });
  if (!record || record.revokedAt) return null;

  const a = Buffer.from(digest, "hex");
  const b = Buffer.from(record.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  after(() =>
    prisma.mcpToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {
        /* trace d'usage : son échec ne doit rien casser */
      }),
  );

  return { userId: record.userId, tokenId: record.id, clientName: record.clientName };
}

/** Identifie l'agent derrière une requête portant `Authorization: Bearer …`. */
export async function identify(request: Request): Promise<McpIdentity | null> {
  return identifyToken(readBearer(request));
}

/** Coupe l'accès d'un agent. Le jeton reste en base, daté de sa révocation. */
export async function revokeToken(userId: string, tokenId: string): Promise<boolean> {
  const { count } = await prisma.mcpToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}

/** Les agents encore actifs sur le compte, pour l'écran de rattachement. */
export async function listAgents(userId: string) {
  return prisma.mcpToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, clientName: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
}
