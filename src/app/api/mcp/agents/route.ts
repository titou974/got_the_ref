import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/queries";
import { prisma } from "@/lib/prisma";
import { listAgents } from "@/features/mcp/tokens";

export const runtime = "nodejs";

/**
 * Les agents appairés au compte, pour l'écran de rattachement.
 *
 * C'est la seule route MCP servie à un navigateur : elle s'authentifie par la
 * session, pas par un jeton d'agent. La modale l'interroge pendant qu'elle est
 * ouverte, et bascule sur « connecté » à la seconde où le client vient
 * d'autoriser son agent depuis un autre onglet.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ agents: [], derniere: null }, { status: 401 });
  }

  const [agents, derniere] = await Promise.all([
    listAgents(user.id),
    prisma.mcpFixReport.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { clientName: true, chantier: true, applied: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    agents: agents.map((agent) => ({
      id: agent.id,
      nom: agent.clientName,
      depuis: agent.createdAt.toISOString(),
      dernierUsage: agent.lastUsedAt?.toISOString() ?? null,
    })),
    derniere: derniere
      ? {
          agent: derniere.clientName,
          chantier: derniere.chantier,
          appliques: derniere.applied.length,
          date: derniere.createdAt.toISOString(),
        }
      : null,
  });
}
