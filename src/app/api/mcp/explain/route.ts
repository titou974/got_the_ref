import { NextResponse } from "next/server";
import { z } from "zod";
import { explainAnalysis } from "@/features/mcp/explain";
import { jsonError, withAgent } from "@/features/mcp/http";

export const runtime = "nodejs";

/** L'explication passe par un modèle : elle a besoin de plus de vingt secondes. */
export const maxDuration = 120;

/**
 * L'explication de l'analyse et des correctifs — la seconde et dernière chose
 * que l'agent sait faire.
 *
 * Le périmètre est tenu par `explainAnalysis` : le modèle ne reçoit que le
 * dossier du compte, et une question qui n'y a pas d'ancrage repart avec la
 * phrase de refus. Rien ici ne rédige, ne code, ne conseille en dehors du
 * rapport.
 */

const schema = z.object({
  question: z.string().trim().min(3).max(1_000),
});

export async function POST(request: Request) {
  return withAgent(request, async ({ userId }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Question invalide.", "BAD_REQUEST", 400);
    }

    const outcome = await explainAnalysis(userId, parsed.data.question);
    return NextResponse.json(outcome);
  });
}
