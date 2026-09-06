import { createMcpHandler } from "mcp-handler";
import {
  registerGotTheRefTools,
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
} from "@/features/mcp/server";
import { identifyToken, looksLikeToken } from "@/features/mcp/tokens";
import { rateLimit } from "@/lib/rate-limit";

/**
 * La prise MCP de got_the_ref, servie par le site.
 *
 * L'agent du client s'y branche par une seule commande — `claude mcp add
 * --transport http got_the_ref https://…/mcp/<clé>` et ses équivalents — et
 * n'installe rien. Le protocole passe en HTTP, sans état d'une requête à
 * l'autre : chaque appel JSON-RPC est indépendant, ce qui est exactement ce
 * qu'attend une fonction serverless, où deux appels d'un même agent
 * n'atterrissent pas forcément sur la même instance.
 *
 * La clé voyage dans le chemin de l'URL plutôt que dans un en-tête. C'est ce
 * qui permet à la commande de tenir sur une ligne dans les quatre agents pris
 * en charge : Cursor et les configurations par fichier n'acceptent qu'une
 * adresse. Une URL est donc ici un secret — elle se traite comme un mot de
 * passe, ne s'indexe pas, ne se met pas en cache, et se coupe depuis le
 * tableau de bord. L'en-tête `Authorization: Bearer` reste accepté pour les
 * agents qui savent l'envoyer.
 */

export const runtime = "nodejs";

/** Un relevé de correctifs lit toute l'analyse : la lecture tient dedans. */
export const maxDuration = 60;

/** Appels autorisés par clé et par fenêtre — un agent en boucle est borné. */
const LIMIT = 120;
const WINDOW_MS = 60_000;

/** Les en-têtes que porte toute réponse : une URL secrète ne se garde nulle part. */
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/**
 * L'erreur rendue à l'agent, au format JSON-RPC.
 *
 * L'interlocuteur est un programme : il lui faut un objet qu'il sait lire, pas
 * une page. Le `WWW-Authenticate` accompagne le 401 pour que l'agent affiche
 * une cause plutôt qu'un échec de connexion muet.
 */
function rpcError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: status === 429 ? -32029 : -32001, message },
    }),
    {
      status,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/json",
        ...(status === 401 ? { "WWW-Authenticate": 'Bearer realm="got_the_ref"' } : {}),
      },
    },
  );
}

/** La clé lue dans l'en-tête `Authorization: Bearer …`, ou `null`. */
function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value.trim() : null;
}

async function handle(
  request: Request,
  { params }: { params: Promise<{ cle: string }> },
): Promise<Response> {
  const { cle } = await params;
  const raw = looksLikeToken(cle) ? cle : bearer(request);

  const identity = await identifyToken(raw);
  if (!identity) {
    return rpcError(
      "Clé absente, expirée ou révoquée. Reprends la commande de connexion dans ton tableau de bord got_the_ref.",
      401,
    );
  }

  if (!rateLimit(`mcp:${identity.tokenId}`, LIMIT, WINDOW_MS).ok) {
    return rpcError("Trop d'appels. Réessaie dans une minute.", 429);
  }

  const handler = createMcpHandler(
    (server) => {
      registerGotTheRefTools(server, identity);
    },
    { serverInfo: SERVER_INFO, instructions: SERVER_INSTRUCTIONS },
  );

  const response = await handler(request);
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export { handle as GET, handle as POST, handle as DELETE };
