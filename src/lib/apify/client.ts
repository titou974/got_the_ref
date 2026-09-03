import "server-only";

/**
 * Le lien avec Apify, une seule porte pour toute l'application.
 *
 * Apify héberge des « acteurs » — des scrapers prêts à l'emploi qu'on appelle
 * comme une API. Celui qui nous intéresse, `compass/crawler-google-places`,
 * rend une fiche Google Maps complète là où le HTML brut de Google ne rend
 * rien : Google monte sa fiche en JavaScript, et un simple `fetch` ne voit ni
 * les avis, ni les horaires, ni les attributs.
 *
 * L'authentification tient en un jeton personnel, lu dans `APIFY_API_KEY`
 * (https://console.apify.com/settings/integrations). Sans jeton,
 * `apifyToken()` rend `null` et l'appelant s'arrête là : aucune requête ne
 * part, et rien n'est facturé.
 */

const BASE_URL = "https://api.apify.com/v2";

/**
 * Un run d'acteur se compte en dizaines de secondes. On borne large côté Apify
 * (`timeout`) et un cran au-dessus côté client, pour que ce soit toujours Apify
 * qui rende la main en premier, avec un message.
 */
const RUN_TIMEOUT_S = 180;
const FETCH_TIMEOUT_MS = (RUN_TIMEOUT_S + 20) * 1000;

export class ApifyError extends Error {
  constructor(
    message: string,
    /** Le code HTTP renvoyé par Apify, ou 0 si la requête n'a pas abouti. */
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

/** Le jeton personnel, ou `null` si la variable n'est pas posée. */
export function apifyToken(): string | null {
  return process.env.APIFY_API_KEY?.trim() || null;
}

/** Vrai quand le jeton est renseigné : sert à masquer ce qui ne marcherait pas. */
export function isApifyConfigured(): boolean {
  return apifyToken() !== null;
}

/**
 * Lance un acteur et attend son résultat.
 *
 * `run-sync-get-dataset-items` fait les trois temps en un appel : démarrer le
 * run, attendre la fin, rendre le jeu de données. C'est le mode le plus simple
 * tant qu'on reste sous les cinq minutes — au-delà, il faudrait passer par un
 * run asynchrone et un webhook.
 *
 * @param actorId identifiant de l'acteur, séparateur tilde (`compass~crawler-google-places`)
 */
export async function runActorSync<T>(
  actorId: string,
  input: Record<string, unknown>,
): Promise<T[]> {
  const token = apifyToken();
  if (!token) throw new ApifyError("Clé API Apify absente (APIFY_API_KEY).", 0);

  const url = new URL(`${BASE_URL}/acts/${actorId}/run-sync-get-dataset-items`);
  url.searchParams.set("token", token);
  url.searchParams.set("timeout", String(RUN_TIMEOUT_S));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "délai dépassé" : "réseau";
    throw new ApifyError(`Apify injoignable (${reason}).`, 0);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Apify renvoie { error: { type, message } } ; le corps peut aussi être vide.
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      /* corps illisible : on garde le code HTTP */
    }
    throw new ApifyError(`Apify a refusé la requête : ${detail}`, res.status);
  }

  const items = (await res.json()) as unknown;
  if (!Array.isArray(items)) throw new ApifyError("Réponse Apify inattendue.", res.status);
  return items as T[];
}
