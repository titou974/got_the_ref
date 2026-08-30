import { NextResponse } from "next/server";
import { withAgent } from "@/features/mcp/http";
import { revokeToken } from "@/features/mcp/tokens";

export const runtime = "nodejs";

/**
 * L'agent rend sa clé.
 *
 * Un agent ne peut révoquer que le jeton qu'il présente : c'est le geste de
 * « déconnecte-moi de ce poste », pas celui de fermer l'accès des autres. Le
 * client, lui, coupe qui il veut depuis son compte.
 */
export async function POST(request: Request) {
  return withAgent(request, async ({ userId, tokenId }) => {
    const done = await revokeToken(userId, tokenId);
    return NextResponse.json({ revoque: done });
  });
}
