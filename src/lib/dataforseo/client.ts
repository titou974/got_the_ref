import "server-only";

/**
 * Le lien avec DataForSEO, une seule porte pour toute l'application.
 *
 * L'API s'authentifie en Basic HTTP : le couple identifiant/mot de passe pris
 * sur https://app.dataforseo.com/api-access, encodé en base64. Deux façons de
 * le donner, parce que les hébergeurs ne rangent pas les secrets pareil :
 *
 *   DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD  le couple en clair, à préférer ;
 *   DATAFORSEO_AUTH                         le base64 « login:password » déjà
 *                                           fabriqué, pour une variable unique.
 *
 * Sans l'un ni l'autre, `dataForSeoAuth()` rend `null` et l'appelant retombe
 * sur son mode démonstration : aucune requête ne part, et rien n'est facturé.
 */

const BASE_URL = "https://api.dataforseo.com";

/** Les points d'entrée « live » répondent en 120 s au pire ; on borne juste après. */
const TIMEOUT_MS = 125_000;

export class DataForSeoError extends Error {
  constructor(
    message: string,
    /** Le code renvoyé par DataForSEO (20000 = succès), ou le code HTTP. */
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }
}

/** L'en-tête d'authentification, ou `null` si le compte n'est pas renseigné. */
export function dataForSeoAuth(): string | null {
  const ready = process.env.DATAFORSEO_AUTH?.trim();
  if (ready) return `Basic ${ready}`;

  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;

  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

/** Vrai quand les identifiants sont posés : sert à choisir entre mesure et exemple. */
export function isDataForSeoConfigured(): boolean {
  return dataForSeoAuth() !== null;
}

type DataForSeoTask<T> = {
  id: string;
  status_code: number;
  status_message: string;
  cost: number;
  result: T[] | null;
};

type DataForSeoResponse<T> = {
  status_code: number;
  status_message: string;
  cost: number;
  tasks: DataForSeoTask<T>[] | null;
};

/**
 * Une tâche « live », envoyée et lue dans le même appel.
 *
 * DataForSEO empile deux niveaux d'état : celui de la réponse et celui de la
 * tâche. Une réponse à 20000 peut porter une tâche en échec — le tableau
 * `result` est alors vide, et laisser passer ce cas donnerait un graphique à
 * zéro là où il faut dire « la mesure n'a pas abouti ». Les deux sont donc
 * vérifiés, et seule la première tâche est lue : ces points d'entrée n'en
 * acceptent qu'une par requête.
 */
export async function dataForSeoLive<TResult>(
  path: string,
  task: Record<string, unknown>,
): Promise<TResult[]> {
  const auth = dataForSeoAuth();
  if (!auth) throw new DataForSeoError("Identifiants DataForSEO absents.", 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      // Le tableau est obligatoire : l'API attend une liste de tâches.
      body: JSON.stringify([task]),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new DataForSeoError(
        `DataForSEO a répondu HTTP ${res.status} sur ${path}.`,
        res.status,
      );
    }

    const payload = (await res.json()) as DataForSeoResponse<TResult>;

    if (payload.status_code !== 20000) {
      throw new DataForSeoError(payload.status_message, payload.status_code);
    }

    const first = payload.tasks?.[0];
    if (!first) throw new DataForSeoError("Réponse DataForSEO sans tâche.", 500);
    if (first.status_code !== 20000) {
      throw new DataForSeoError(first.status_message, first.status_code);
    }

    return first.result ?? [];
  } finally {
    clearTimeout(timer);
  }
}
