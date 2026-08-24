import "server-only";

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/constants/site";

/**
 * Le rattachement Google : Search Console et Analytics 4, en un consentement.
 *
 * On n'emprunte pas la connexion Google de Better Auth : elle ouvre une session,
 * pas un accès aux données, et lui greffer ces scopes les réclamerait à tout le
 * monde dès l'inscription. Ici c'est un consentement à part, demandé à l'étape 7,
 * refusable sans conséquence sur le compte.
 *
 * Les deux services sont demandés ensemble parce qu'ils ne mesurent pas la même
 * chose : Search Console dit ce que les moteurs montrent de vous (requêtes,
 * positions, impressions), Analytics dit ce que cela devient une fois le clic
 * passé — et il est le seul à voir arriver les visites depuis ChatGPT ou
 * Perplexity, que Search Console ne connaît pas. Deux allers-retours OAuth à la
 * dernière étape du tunnel, ce serait deux occasions d'abandonner.
 *
 * Le lien est en lecture seule des deux côtés : on relève, on n'écrit jamais.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

const GSC_SCOPE = SCOPES[0];
const GA4_SCOPE = SCOPES[1];

const STATE_COOKIE = "gottheref_google_state";
/**
 * Où ramener le client au retour de Google. Le tunnel d'accueil et le tableau
 * de bord ouvrent le même consentement ; sans cette trace, un rattachement
 * lancé depuis le tableau de bord renverrait le client à l'étape 7 du tunnel
 * qu'il a déjà terminée.
 */
const RETURN_COOKIE = "gottheref_google_return";
const STATE_MAX_AGE = 60 * 15;

/**
 * Combien de propriétés Analytics on accepte d'inspecter en détail.
 *
 * Retrouver l'URL d'une propriété GA4 coûte une requête par propriété (voir
 * `listGa4Properties`). Un client ordinaire en a deux ou trois ; une agence peut
 * en avoir quarante, et l'étape tournerait alors en silence assez longtemps pour
 * qu'on la croie plantée. Au-delà de la borne on renonce à l'appariement fin.
 */
const GA4_DETAIL_LIMIT = 12;

export const isGoogleConfigured = (): boolean =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const googleRedirectUri = (): string => `${SITE.url}/api/google/callback`;

/**
 * Prépare l'aller vers Google : un `state` aléatoire déposé en cookie httpOnly,
 * recopié dans l'URL. Au retour, les deux doivent coïncider — sans quoi
 * n'importe quel lien pourrait rattacher les propriétés d'un tiers au compte
 * ouvert dans ce navigateur (CSRF sur le flux OAuth).
 */
export async function buildGoogleAuthUrl(returnTo?: string | null): Promise<string> {
  const state = randomBytes(24).toString("hex");
  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  };

  store.set(STATE_COOKIE, state, cookieOptions);

  // Un chemin interne uniquement : la valeur finit dans un en-tête `Location`,
  // et une URL absolue en ferait une redirection ouverte.
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    store.set(RETURN_COOKIE, returnTo, cookieOptions);
  } else {
    store.delete(RETURN_COOKIE);
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    // `offline` + `consent` : sans les deux, Google ne redonne pas de refresh
    // token à la deuxième autorisation, et le lien meurt au bout d'une heure.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Le chemin de retour déposé au départ, consommé lui aussi une seule fois. */
export async function consumeGoogleReturn(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(RETURN_COOKIE)?.value ?? null;
  store.delete(RETURN_COOKIE);
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/** Vérifie le `state` du retour, puis brûle le cookie — il ne sert qu'une fois. */
export async function consumeGoogleState(presented: string | null): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? null;
  store.delete(STATE_COOKIE);

  if (!presented || !expected) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

/** Échange le code d'autorisation contre les jetons. */
export async function exchangeGoogleCode(code: string): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  return (await response.json()) as TokenResponse;
}

/**
 * Ce que le client a réellement accordé.
 *
 * L'écran de consentement Google présente une case par service : demander les
 * deux ne garantit pas d'obtenir les deux. Sans cette lecture, un refus partiel
 * passerait pour un succès complet, et l'on annoncerait au client un
 * rattachement Analytics qui n'existe pas.
 */
export const grantedScopes = (
  scope: string | null | undefined,
): { gsc: boolean; ga4: boolean } => {
  const granted = new Set((scope ?? "").split(" ").filter(Boolean));
  return { gsc: granted.has(GSC_SCOPE), ga4: granted.has(GA4_SCOPE) };
};

export type GscProperty = { siteUrl: string; permissionLevel: string };

/** Les propriétés Search Console visibles avec ce jeton. */
export async function listGscProperties(accessToken: string): Promise<GscProperty[]> {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    siteEntry?: { siteUrl?: string; permissionLevel?: string }[];
  };

  return (payload.siteEntry ?? [])
    .filter((entry): entry is { siteUrl: string; permissionLevel: string } =>
      Boolean(entry.siteUrl),
    )
    .map((entry) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel ?? "unknown",
    }));
}

export type Ga4Property = {
  /** Nom de ressource complet, « properties/123456789 ». */
  name: string;
  displayName: string;
  /** URL du flux web, quand la propriété en expose un. */
  defaultUri: string | null;
  measurementId: string | null;
};

/**
 * Les propriétés Analytics 4 visibles avec ce jeton, avec l'URL de leur site.
 *
 * En deux temps, faute de mieux. `accountSummaries` liste bien les propriétés,
 * mais une propriété GA4 ne porte aucune URL : seulement un `displayName` libre,
 * que le client a pu appeler « Prod », « Site v2 » ou du nom de son agence. On ne
 * peut donc pas la rapprocher du domaine déclaré à l'étape 2, contrairement à
 * Search Console dont les propriétés *sont* des URL.
 *
 * L'URL se trouve un cran plus bas : chaque flux web d'une propriété expose son
 * `defaultUri`. D'où la seconde salve de requêtes, une par propriété — menées de
 * front, sinon dix propriétés feraient dix allers-retours en file.
 */
export async function listGa4Properties(accessToken: string): Promise<Ga4Property[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const response = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    { headers },
  );
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    accountSummaries?: {
      propertySummaries?: { property?: string; displayName?: string }[];
    }[];
  };

  const summaries = (payload.accountSummaries ?? [])
    .flatMap((account) => account.propertySummaries ?? [])
    .filter((property): property is { property: string; displayName?: string } =>
      Boolean(property.property),
    )
    .map((property) => ({
      name: property.property,
      displayName: property.displayName ?? property.property,
    }));

  // Au-delà de la borne, on rend la liste sans URL : l'appariement par domaine
  // échouera et l'on retombera sur la première propriété, comme pour GSC.
  if (summaries.length > GA4_DETAIL_LIMIT) {
    return summaries.map((summary) => ({
      ...summary,
      defaultUri: null,
      measurementId: null,
    }));
  }

  return Promise.all(
    summaries.map(async (summary) => {
      const stream = await fetchPrimaryWebStream(summary.name, headers);
      return { ...summary, ...stream };
    }),
  );
}

/** Le premier flux web d'une propriété — c'est lui qui porte l'URL du site. */
async function fetchPrimaryWebStream(
  property: string,
  headers: Record<string, string>,
): Promise<{ defaultUri: string | null; measurementId: string | null }> {
  const empty = { defaultUri: null, measurementId: null };

  try {
    const response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/${property}/dataStreams?pageSize=50`,
      { headers },
    );
    if (!response.ok) return empty;

    const payload = (await response.json()) as {
      dataStreams?: {
        webStreamData?: { defaultUri?: string; measurementId?: string };
      }[];
    };

    const web = (payload.dataStreams ?? []).find((stream) => stream.webStreamData?.defaultUri);
    if (!web?.webStreamData) return empty;

    return {
      defaultUri: web.webStreamData.defaultUri ?? null,
      measurementId: web.webStreamData.measurementId ?? null,
    };
  } catch {
    // Une propriété illisible ne doit pas emporter les onze autres.
    return empty;
  }
}

/**
 * Enregistre le rattachement. Des deux côtés, la propriété retenue est celle qui
 * correspond au domaine déjà déclaré à l'étape 2 — c'est presque toujours la
 * bonne, et la faire choisir dans une liste de vingt ferait une étape de plus.
 */
export async function saveGoogleConnection({
  userId,
  tokens,
  gscProperties,
  ga4Properties,
  domain,
}: {
  userId: string;
  tokens: TokenResponse;
  gscProperties: GscProperty[];
  ga4Properties: Ga4Property[];
  domain: string | null;
}): Promise<void> {
  const gsc = pickForDomain(gscProperties, domain, (property) => property.siteUrl);
  const ga4 = pickForDomain(ga4Properties, domain, (property) => property.defaultUri);

  const data = {
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    scope: tokens.scope ?? null,

    siteUrl: gsc?.siteUrl ?? null,
    properties: JSON.stringify(gscProperties),

    ga4PropertyId: ga4?.name ?? null,
    ga4PropertyName: ga4?.displayName ?? null,
    ga4MeasurementId: ga4?.measurementId ?? null,
    ga4Properties: JSON.stringify(ga4Properties),
  };

  await prisma.googleConnection.upsert({
    where: { userId },
    create: { userId, ...data },
    // Google ne renvoie pas toujours un refresh token : on garde l'ancien
    // plutôt que d'écraser le seul jeton durable par null.
    update: {
      ...data,
      refreshToken: data.refreshToken ?? undefined,
    },
  });
}

/**
 * La propriété qui parle du domaine du client, à défaut la première.
 *
 * Le repli sur la première n'est pas un hasard heureux : dans l'immense majorité
 * des comptes il n'y en a qu'une, et ne rien retenir obligerait à afficher un
 * sélecteur pour un choix qui n'en est pas un.
 */
function pickForDomain<T>(
  properties: T[],
  domain: string | null,
  locate: (property: T) => string | null,
): T | undefined {
  if (properties.length === 0) return undefined;

  const matching = domain
    ? properties.find((property) => locate(property)?.includes(domain))
    : undefined;

  return matching ?? properties[0];
}
