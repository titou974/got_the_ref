import { NextResponse } from "next/server";
import { AGENT_CHARTER, CHARTER_REMINDER } from "@/features/mcp/charter";
import { withAgent } from "@/features/mcp/http";
import { buildStatus } from "@/features/mcp/payload";

export const runtime = "nodejs";

/**
 * Le statut du compte appairé : l'offre, le site, l'analyse en cours, et les
 * chantiers que l'offre ouvre.
 *
 * C'est le premier appel de l'agent, avant toute modification. La charte part
 * avec : l'agent la relit à chaque session, sans dépendre de ce que sa version
 * installée peut en dire.
 */
export async function GET(request: Request) {
  return withAgent(request, async ({ userId, email, clientName }) => {
    const statut = await buildStatus(userId, email);
    return NextResponse.json({
      ...statut,
      agent: { nom: clientName },
      charte: AGENT_CHARTER,
      rappel: CHARTER_REMINDER,
    });
  });
}
