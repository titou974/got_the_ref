import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, withAgent } from "@/features/mcp/http";

export const runtime = "nodejs";

/**
 * Ce que l'agent rapporte une fois sa passe terminée.
 *
 * La déclaration est celle de l'agent, pas une vérification : elle dit ce qui a
 * été tenté. Le tableau de bord l'affiche comme telle — « Claude Code a
 * appliqué 4 correctifs il y a trois minutes » —, et c'est la remesure suivante
 * qui tranche.
 */

const schema = z.object({
  chantier: z.string().trim().min(1).max(40),
  appliques: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  ecartes: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  note: z.string().trim().max(2_000).optional(),
});

export async function POST(request: Request) {
  return withAgent(request, async ({ userId, clientName }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Rapport invalide.", "BAD_REQUEST", 400);
    }

    const { chantier, appliques, ecartes, note } = parsed.data;

    await prisma.mcpFixReport.create({
      data: {
        userId,
        clientName,
        chantier,
        applied: appliques,
        skipped: ecartes,
        note: note ?? null,
      },
    });

    return NextResponse.json({
      enregistre: true,
      appliques: appliques.length,
      ecartes: ecartes.length,
    });
  });
}
