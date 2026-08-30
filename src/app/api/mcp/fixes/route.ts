import { NextResponse } from "next/server";
import { withAgent, jsonError } from "@/features/mcp/http";
import { buildFixes } from "@/features/mcp/payload";

export const runtime = "nodejs";

/** L'audit d'entrée peut durer : la lecture, elle, tient largement dedans. */
export const maxDuration = 60;

/**
 * Les correctifs à appliquer, chantier par chantier, avec les textes exacts.
 *
 * Le tri par offre est fait dans `buildFixes` : un chantier fermé arrive nommé,
 * accompagné de l'offre qui l'ouvre, et avec un dossier vide. L'agent ne peut
 * donc pas reconstituer ce qui n'est pas payé — il n'y a rien à reconstituer.
 *
 * Le paramètre `chantier` restreint la réponse à un onglet : un agent qui vient
 * de tout appliquer sauf les articles n'a pas besoin de retélécharger le reste.
 */
export async function GET(request: Request) {
  return withAgent(request, async ({ userId }) => {
    const fixes = await buildFixes(userId);
    if (!fixes) {
      return jsonError(
        "Aucune analyse rattachée à ce compte. Lance l'audit depuis le tableau de bord got_the_ref.",
        "NO_ANALYSIS",
        404,
      );
    }

    const wanted = new URL(request.url).searchParams.get("chantier");
    if (!wanted) return NextResponse.json(fixes);

    const correctifs = fixes.correctifs.filter((c) => c.chantier === wanted);
    if (correctifs.length === 0) {
      return jsonError(
        `Chantier inconnu : « ${wanted} ». Chantiers disponibles : ${fixes.correctifs
          .map((c) => c.chantier)
          .join(", ")}.`,
        "UNKNOWN_SCOPE",
        400,
      );
    }

    return NextResponse.json({ ...fixes, correctifs });
  });
}
