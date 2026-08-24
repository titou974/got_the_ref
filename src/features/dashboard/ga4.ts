import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Le trafic amené par les IA, lu dans Google Analytics 4.
 *
 * Search Console ne voit pas ces visites : ChatGPT, Perplexity ou Gemini ne
 * sont pas Google Search, et leurs clics arrivent sur le site sans passer par
 * une page de résultats. Analytics, lui, les voit arriver, à condition de savoir
 * les reconnaître. Chaque assistant se signale autrement :
 *
 *   ChatGPT    ajoute `?utm_source=chatgpt.com` à ses liens sortants, donc GA4
 *              range la visite dans la source « chatgpt.com ». Sans le
 *              paramètre, le référent `chatgpt.com` donne le même résultat.
 *   Perplexity n'ajoute pas d'`utm_source` : ses liens portent
 *              `?ct-referrer=perplexity`, un paramètre maison qu'Analytics
 *              ignore. La visite reste identifiable par son référent,
 *              `perplexity.ai`, que GA4 enregistre comme source.
 *   Gemini     n'ajoute rien du tout. Le référent `gemini.google.com` reste la
 *              seule trace, et il ne couvre que les clics depuis l'application.
 *              Les liens des AI Overviews, eux, partent de `google.com` et se
 *              confondent avec le référencement classique : cette part-là,
 *              personne ne peut la mesurer aujourd'hui, et l'interface le dit
 *              plutôt que de gonfler le chiffre.
 *
 * Le rapprochement se fait donc sur la source de session, pas sur le paramètre
 * d'URL. Un client qui pose `?ct-referrer=perplexity` dans ses propres liens ne
 * change rien à ce qui est compté ici.
 */

/** Les assistants suivis, et ce qui les trahit dans la source de session GA4. */
export const AI_ENGINES = [
  { id: "chatgpt", label: "ChatGPT", sources: ["chatgpt.com", "chat.openai.com", "openai.com"] },
  { id: "perplexity", label: "Perplexity", sources: ["perplexity.ai", "perplexity"] },
  { id: "gemini", label: "Gemini", sources: ["gemini.google.com", "bard.google.com"] },
  { id: "claude", label: "Claude", sources: ["claude.ai", "anthropic.com"] },
  { id: "copilot", label: "Copilot", sources: ["copilot.microsoft.com", "bing.com/chat"] },
] as const;

export type AiEngineId = (typeof AI_ENGINES)[number]["id"];

export type EngineTraffic = {
  id: AiEngineId;
  label: string;
  sessions: number;
  /** Sessions de la période précédente, de même longueur. */
  previousSessions: number;
};

export type TrafficPoint = { date: string; sessions: number };

export type AiTrafficReport = {
  /** Nombre de jours couverts. */
  days: number;
  totalSessions: number;
  previousTotalSessions: number;
  /** Sessions du site, tous canaux confondus : donne la part des IA. */
  siteSessions: number;
  engines: EngineTraffic[];
  /** Une valeur par jour, additionnée sur tous les assistants. */
  series: TrafficPoint[];
};

type GoogleLink = {
  ga4PropertyId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
};

/**
 * Un jeton d'accès valide, renouvelé si besoin.
 *
 * Le jeton d'accès Google dure une heure ; le tableau de bord, lui, est consulté
 * des semaines après le rattachement. Le refresh token est donc la seule pièce
 * durable, et c'est lui qui fabrique les jetons suivants.
 */
async function freshAccessToken(userId: string, link: GoogleLink): Promise<string | null> {
  const stillValid = link.accessToken && link.expiresAt && link.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return link.accessToken;

  if (!link.refreshToken) return null;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: link.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return null;

  await prisma.googleConnection.update({
    where: { userId },
    data: {
      accessToken: payload.access_token,
      expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    },
  });

  return payload.access_token;
}

type ReportRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };

async function runReport(
  token: string,
  property: string,
  body: Record<string, unknown>,
): Promise<ReportRow[]> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // La Data API tolère mal le cache de Next : une requête datée d'hier
      // renverrait les chiffres d'hier.
      cache: "no-store",
    },
  );

  if (!response.ok) return [];
  const payload = (await response.json()) as { rows?: ReportRow[] };
  return payload.rows ?? [];
}

/** L'assistant derrière une source de session, ou `null` si ce n'en est pas un. */
function engineForSource(source: string): AiEngineId | null {
  const value = source.toLowerCase();
  const match = AI_ENGINES.find((engine) => engine.sources.some((hint) => value.includes(hint)));
  return match?.id ?? null;
}

const isoDay = (offsetDays: number): string =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * Le rapport de trafic IA sur `days` jours, comparé à la période précédente.
 *
 * Renvoie `null` quand le compte n'a pas de propriété Analytics rattachée ou que
 * Google refuse le jeton : l'interface propose alors le rattachement au lieu
 * d'afficher des zéros qui passeraient pour une absence de trafic.
 */
export async function fetchAiTraffic(
  userId: string,
  days = 30,
): Promise<AiTrafficReport | null> {
  const link = await prisma.googleConnection.findUnique({
    where: { userId },
    select: { ga4PropertyId: true, accessToken: true, refreshToken: true, expiresAt: true },
  });

  if (!link?.ga4PropertyId) return null;

  const token = await freshAccessToken(userId, link);
  if (!token) return null;

  const property = link.ga4PropertyId;
  const current = { startDate: isoDay(days), endDate: "today" };
  const previous = { startDate: isoDay(days * 2), endDate: isoDay(days + 1) };

  const [dailyRows, previousRows, siteRows] = await Promise.all([
    runReport(token, property, {
      dateRanges: [current],
      dimensions: [{ name: "date" }, { name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      limit: 5000,
    }),
    runReport(token, property, {
      dateRanges: [previous],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      limit: 1000,
    }),
    runReport(token, property, {
      dateRanges: [current],
      metrics: [{ name: "sessions" }],
    }),
  ]);

  const perEngine = new Map<AiEngineId, number>();
  const perDay = new Map<string, number>();

  for (const row of dailyRows) {
    const date = row.dimensionValues?.[0]?.value ?? "";
    const engine = engineForSource(row.dimensionValues?.[1]?.value ?? "");
    if (!engine) continue;

    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    perEngine.set(engine, (perEngine.get(engine) ?? 0) + sessions);
    perDay.set(date, (perDay.get(date) ?? 0) + sessions);
  }

  const perEnginePrevious = new Map<AiEngineId, number>();
  for (const row of previousRows) {
    const engine = engineForSource(row.dimensionValues?.[0]?.value ?? "");
    if (!engine) continue;
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    perEnginePrevious.set(engine, (perEnginePrevious.get(engine) ?? 0) + sessions);
  }

  // Un jour sans visite IA n'apparaît pas dans la réponse d'Analytics. La courbe
  // le comblerait par une ligne droite entre deux points éloignés : on remet les
  // zéros pour que le creux se voie.
  const series: TrafficPoint[] = Array.from({ length: days }, (_, index) => {
    const date = isoDay(days - 1 - index).replace(/-/g, "");
    return { date, sessions: perDay.get(date) ?? 0 };
  });

  const engines: EngineTraffic[] = AI_ENGINES.map((engine) => ({
    id: engine.id,
    label: engine.label,
    sessions: perEngine.get(engine.id) ?? 0,
    previousSessions: perEnginePrevious.get(engine.id) ?? 0,
  })).sort((a, b) => b.sessions - a.sessions);

  return {
    days,
    totalSessions: engines.reduce((sum, engine) => sum + engine.sessions, 0),
    previousTotalSessions: engines.reduce((sum, engine) => sum + engine.previousSessions, 0),
    siteSessions: Number(siteRows[0]?.metricValues?.[0]?.value ?? 0),
    engines,
    series,
  };
}
