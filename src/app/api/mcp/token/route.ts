import { NextResponse } from "next/server";
import { z } from "zod";
import { pollDevice } from "@/features/mcp/device";
import { jsonError, limitByIp } from "@/features/mcp/http";

export const runtime = "nodejs";

/**
 * Le relevé de l'agent pendant qu'il attend la confirmation du client.
 *
 * Tant que le code n'est pas confirmé, la réponse est « pending » et l'agent
 * repasse quelques secondes plus tard. À la confirmation, le jeton est rendu
 * une fois et la ligne d'appairage disparaît.
 */

const schema = z.object({
  device_code: z.string().min(10).max(200),
});

/** Un relevé toutes les trois secondes pendant un quart d'heure : 300 suffisent. */
const LIMIT = 300;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  if (!limitByIp(request, "mcp-token", LIMIT, WINDOW_MS)) {
    return jsonError("Trop de relevés.", "RATE_LIMITED", 429);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", "BAD_REQUEST", 400);
  }

  const outcome = await pollDevice(parsed.data.device_code);

  if (outcome.status === "approved") {
    return NextResponse.json({ status: "approved", access_token: outcome.token });
  }
  return NextResponse.json({ status: outcome.status });
}
