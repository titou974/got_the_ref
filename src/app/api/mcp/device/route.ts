import { NextResponse } from "next/server";
import { z } from "zod";
import { SITE } from "@/constants/site";
import { startDevice } from "@/features/mcp/device";
import { jsonError, limitByIp } from "@/features/mcp/http";

export const runtime = "nodejs";

/**
 * Ouverture d'un appairage : l'agent demande un code, on lui rend le code court
 * à faire lire au client et l'adresse où le confirmer.
 *
 * Route ouverte — il n'existe encore aucun jeton à présenter. Elle ne crée rien
 * d'exploitable : tant que le propriétaire du compte n'a pas confirmé le code
 * dans son navigateur, la ligne ne donne accès à rien.
 */

const schema = z.object({
  client: z.string().trim().min(1).max(60).optional(),
});

/** Cinq appairages par adresse et par quart d'heure : un agent en ouvre un. */
const LIMIT = 5;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  if (!limitByIp(request, "mcp-device", LIMIT, WINDOW_MS)) {
    return jsonError("Trop de demandes d'appairage.", "RATE_LIMITED", 429);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", "BAD_REQUEST", 400);
  }

  const device = await startDevice(parsed.data.client ?? "agent", SITE.url);

  return NextResponse.json({
    device_code: device.deviceCode,
    user_code: device.userCode,
    verification_url: device.verificationUrl,
    expires_in: device.expiresIn,
    interval: device.interval,
  });
}
