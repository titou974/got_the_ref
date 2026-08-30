import { API_URL } from "./config.js";
import { readToken } from "./store.js";

/**
 * Le dialogue avec la plateforme.
 *
 * Toute la logique de droits vit là-bas : ce module ne fait que transporter. Il
 * ne filtre rien, ne complète rien, ne devine rien — un correctif fermé par
 * l'offre arrive vide, et il arrive vide jusque dans la réponse de l'outil.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

async function parse(response: Response): Promise<Json> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Json;
  } catch {
    throw new ApiError(
      `Réponse illisible de got_the_ref (HTTP ${response.status}).`,
      "BAD_RESPONSE",
      response.status,
    );
  }
}

/** Un appel ouvert : l'appairage, seul moment où l'on n'a pas encore de jeton. */
export async function callPublic(path: string, body: Json): Promise<Json> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parse(response);
  if (!response.ok) {
    throw new ApiError(
      String(payload.error ?? "Appel refusé."),
      String(payload.code ?? "ERROR"),
      response.status,
    );
  }
  return payload;
}

/** Un appel signé par le jeton du compte. */
export async function callAuthed(
  path: string,
  init: { method?: "GET" | "POST"; body?: Json } = {},
): Promise<Json> {
  const token = readToken(API_URL);
  if (!token) {
    throw new ApiError(
      "Aucun compte connecté. Lance got_the_ref_connexion pour appairer cet agent.",
      "NO_TOKEN",
      401,
    );
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const payload = await parse(response);
  if (!response.ok) {
    throw new ApiError(
      String(payload.error ?? "Appel refusé."),
      String(payload.code ?? "ERROR"),
      response.status,
    );
  }
  return payload;
}

/** Vrai si un jeton est déjà rangé sur ce poste. */
export function hasToken(): boolean {
  return readToken(API_URL) !== null;
}
