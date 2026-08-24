import "server-only";

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/constants/site";

/**
 * Le rattachement Google Search Console.
 *
 * On n'emprunte pas la connexion Google de Better Auth : elle ouvre une session,
 * pas un accès aux données Search Console, et lui greffer le scope
 * `webmasters.readonly` demanderait cette permission à tout le monde dès
 * l'inscription. Ici c'est un consentement à part, réclamé à l'étape 7, refusable
 * sans conséquence sur le compte.
 *
 * Le lien est en lecture seule : on relève les positions, on n'écrit jamais dans
 * la propriété du client.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const STATE_COOKIE = "gottheref_gsc_state";
const STATE_MAX_AGE = 60 * 15;

export const isGscConfigured = (): boolean =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const gscRedirectUri = (): string => `${SITE.url}/api/gsc/callback`;

/**
 * Prépare l'aller vers Google : un `state` aléatoire déposé en cookie httpOnly,
 * recopié dans l'URL. Au retour, les deux doivent coïncider — sans quoi
 * n'importe quel lien pourrait rattacher la propriété d'un tiers au compte
 * ouvert dans ce navigateur (CSRF sur le flux OAuth).
 */
export async function buildGscAuthUrl(): Promise<string> {
  const state = randomBytes(24).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: gscRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    // `offline` + `consent` : sans les deux, Google ne redonne pas de refresh
    // token à la deuxième autorisation, et le lien meurt au bout d'une heure.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Vérifie le `state` du retour, puis brûle le cookie — il ne sert qu'une fois. */
export async function consumeGscState(presented: string | null): Promise<boolean> {
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
export async function exchangeGscCode(code: string): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: gscRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  return (await response.json()) as TokenResponse;
}

/** Les propriétés Search Console visibles avec ce jeton. */
export async function listGscProperties(accessToken: string): Promise<
  { siteUrl: string; permissionLevel: string }[]
> {
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

/**
 * Enregistre le rattachement. La propriété retenue est celle qui correspond au
 * domaine déjà déclaré à l'étape 2 — c'est presque toujours la bonne, et la
 * faire choisir dans une liste de vingt propriétés ferait une étape de plus.
 */
export async function saveGscConnection({
  userId,
  tokens,
  properties,
  domain,
}: {
  userId: string;
  tokens: TokenResponse;
  properties: { siteUrl: string; permissionLevel: string }[];
  domain: string | null;
}): Promise<void> {
  const matching = domain
    ? properties.find((property) => property.siteUrl.includes(domain))
    : undefined;

  const data = {
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    scope: tokens.scope ?? null,
    siteUrl: (matching ?? properties[0])?.siteUrl ?? null,
    properties: JSON.stringify(properties),
  };

  await prisma.gscConnection.upsert({
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
