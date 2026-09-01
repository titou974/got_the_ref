import "server-only";

import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mintToken } from "./tokens";

/**
 * L'appairage d'un agent, façon « device flow ».
 *
 * Un agent tourne dans un terminal : il n'a ni cookie, ni page de connexion, et
 * lui faire saisir un mot de passe reviendrait à demander au client de taper
 * ses identifiants dans une boîte de dialogue d'un programme tiers. On procède
 * donc comme un téléviseur qui se relie à un compte : l'agent demande un code,
 * le client ouvre got_the_ref dans son navigateur — où il est déjà identifié —,
 * confirme le code affiché, et l'agent récupère son jeton.
 *
 * Trois secrets, trois usages :
 *   — `deviceCode` : détenu par l'agent seul, il sert à interroger l'appairage ;
 *   — `userCode` : lu à l'écran, court, tapé ou cliqué par le client ;
 *   — le jeton : accordé à l'autorisation, retiré au premier relevé de l'agent.
 */

/** Un appairage non confirmé meurt en quinze minutes. */
const TTL_MS = 15 * 60 * 1000;

/** Le rythme de relevé demandé à l'agent, en secondes. */
export const POLL_INTERVAL_SECONDS = 3;

/**
 * L'alphabet du code lu à l'écran. Ni O ni 0, ni I ni 1 : le client recopie ce
 * qu'il lit, et ces quatre-là se confondent dans toutes les polices.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Le code affiché : deux groupes de quatre, séparés par un tiret. */
function newUserCode(): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    if (i === 4) out += "-";
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/** Normalise ce que le client tape : minuscules, espaces, tiret manquant. */
export function normalizeUserCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 8) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export type DeviceStart = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
};

/**
 * Ouvre un appairage. Le nom du client est ce que l'agent déclare de lui-même
 * (« Claude Code », « Cursor ») : il n'est là que pour que le propriétaire du
 * compte reconnaisse ce qu'il autorise, et n'accorde aucun droit.
 */
export async function startDevice(clientName: string, appUrl: string): Promise<DeviceStart> {
  const deviceCode = randomBytes(32).toString("base64url");
  const userCode = newUserCode();

  await prisma.mcpDeviceCode.create({
    data: {
      deviceCode,
      userCode,
      clientName: clientName.slice(0, 60),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  // Ménage opportuniste : les appairages jamais confirmés s'accumuleraient
  // sinon indéfiniment, chacun tenant un code court réservé.
  await prisma.mcpDeviceCode
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {
      /* ménage : son échec ne doit pas empêcher un appairage */
    });

  return {
    deviceCode,
    userCode,
    verificationUrl: `${appUrl}/agent?code=${encodeURIComponent(userCode)}`,
    expiresIn: Math.floor(TTL_MS / 1000),
    interval: POLL_INTERVAL_SECONDS,
  };
}

export type DevicePoll =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; token: string };

/**
 * Le relevé de l'agent. Un jeton accordé n'est rendu qu'une fois : la ligne
 * part avec lui, et l'agent qui perdrait sa réponse doit refaire un appairage.
 */
export async function pollDevice(deviceCode: string): Promise<DevicePoll> {
  const record = await prisma.mcpDeviceCode.findUnique({ where: { deviceCode } });
  if (!record) return { status: "expired" };

  if (record.expiresAt < new Date()) {
    await prisma.mcpDeviceCode.delete({ where: { id: record.id } }).catch(() => {});
    return { status: "expired" };
  }

  if (record.status === "denied") {
    await prisma.mcpDeviceCode.delete({ where: { id: record.id } }).catch(() => {});
    return { status: "denied" };
  }

  if (record.status === "approved" && record.grantedToken) {
    await prisma.mcpDeviceCode.delete({ where: { id: record.id } }).catch(() => {});
    return { status: "approved", token: record.grantedToken };
  }

  return { status: "pending" };
}

/** L'appairage désigné par le code lu à l'écran, s'il court encore. */
export async function findPendingByUserCode(userCode: string) {
  const record = await prisma.mcpDeviceCode.findUnique({
    where: { userCode: normalizeUserCode(userCode) },
    select: { id: true, userCode: true, clientName: true, status: true, expiresAt: true },
  });
  if (!record) return null;
  if (record.expiresAt < new Date()) return null;
  return record;
}

export type ApproveOutcome = "approved" | "unknown" | "already";

/**
 * Le client autorise l'agent : un jeton est accordé au compte, et déposé sur la
 * ligne d'appairage jusqu'au prochain relevé.
 *
 * `updateMany` sur l'état `pending` fait office de verrou : deux clics sur le
 * bouton n'accordent pas deux jetons, le second ne trouve plus rien à mettre à
 * jour.
 */
export async function approveDevice(
  userCode: string,
  userId: string,
): Promise<ApproveOutcome> {
  const code = normalizeUserCode(userCode);
  const record = await prisma.mcpDeviceCode.findUnique({ where: { userCode: code } });
  if (!record || record.expiresAt < new Date()) return "unknown";
  if (record.status !== "pending") return "already";

  const token = await mintToken(userId, record.clientName);

  const { count } = await prisma.mcpDeviceCode.updateMany({
    where: { id: record.id, status: "pending" },
    data: {
      status: "approved",
      userId,
      grantedToken: token,
      approvedAt: new Date(),
    },
  });

  return count > 0 ? "approved" : "already";
}

/** Le client refuse l'agent : l'appairage meurt à son prochain relevé. */
export async function denyDevice(userCode: string): Promise<boolean> {
  const { count } = await prisma.mcpDeviceCode.updateMany({
    where: { userCode: normalizeUserCode(userCode), status: "pending" },
    data: { status: "denied" },
  });
  return count > 0;
}
