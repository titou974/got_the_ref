import "server-only";

import type { ZodType } from "zod";
import { geoLog } from "@/lib/geo/log";
import { postJson } from "@/lib/geo/providers";

/**
 * Gemini avec la recherche Google branchée dessus.
 *
 * Les autres appels du produit passent par `lib/ai/client` : DeepSeek répond
 * de mémoire, ce qui convient pour reformuler ou noter un texte qu'on lui
 * fournit. Chercher des concurrents est un autre métier — il faut aller voir
 * qui existe vraiment aujourd'hui, à cette adresse, dans cette ville. Seul un
 * modèle relié à un index le peut ; sans lui, on obtient des enseignes
 * plausibles et fermées depuis deux ans.
 *
 * Le grounding et le mode JSON natif de Gemini ne cohabitent pas : dès qu'un
 * outil de recherche est actif, la réponse revient en texte. On demande donc le
 * JSON dans la consigne et on le récupère dans le texte, comme pour les
 * mots-clés tendances.
 */

/** Une page réellement consultée par le modèle pour bâtir sa réponse. */
export type GroundedSource = {
  title: string | null;
  url: string;
  domain: string;
};

export type GroundedAnswer<T> = {
  data: T;
  /** Les pages citées par le grounding, dédoublonnées par domaine. */
  sources: GroundedSource[];
};

/** Vrai si la clé Gemini est en place : sinon, rien à tenter. */
export const isGeminiConfigured = (): boolean => Boolean(process.env.GEMINI_API_KEY);

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Isole le premier objet JSON d'une réponse, éventuellement enrobée de ```json. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Interroge Gemini avec la recherche Google, valide la réponse contre un schéma
 * Zod et rend aussi les sources consultées.
 *
 * Rend `null` — jamais une exception — quand la clé manque ou que la réponse est
 * inexploitable : l'appelant garde ainsi la main pour retomber sur son repli
 * plutôt que de faire échouer une étape du tunnel.
 */
export async function askGeminiGrounded<T>(
  schema: ZodType<T>,
  options: { prompt: string; label?: string; maxOutputTokens?: number },
): Promise<GroundedAnswer<T> | null> {
  const key = process.env.GEMINI_API_KEY;
  const label = options.label ?? "Gemini";
  if (!key) {
    geoLog(`${label} — ignoré (pas de clé GEMINI_API_KEY)`);
    return null;
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  geoLog(`${label} — appel (${model}, google_search)…`);

  try {
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: options.maxOutputTokens ?? 2000,
          },
        }),
      },
      label,
    )) as Record<string, unknown>;

    const candidate = (data.candidates as Array<Record<string, unknown>> | undefined)?.[0];
    const parts =
      ((candidate?.content as Record<string, unknown>)?.parts as Array<{ text?: string }>) ?? [];
    const text = parts
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n");

    const parsed = schema.safeParse(extractJson(text));
    if (!parsed.success) {
      geoLog(`${label} — réponse hors schéma`, {
        erreur: parsed.error.message.slice(0, 300),
        aperçu: text.slice(0, 300),
      });
      return null;
    }

    const grounding = candidate?.groundingMetadata as Record<string, unknown> | undefined;
    const chunks =
      (grounding?.groundingChunks as Array<{ web?: { uri?: string; title?: string } }>) ?? [];

    const seen = new Set<string>();
    const sources: GroundedSource[] = [];
    for (const chunk of chunks) {
      const url = chunk.web?.uri ?? "";
      if (!url) continue;
      const title = chunk.web?.title ?? null;
      // Gemini met souvent le domaine dans le titre et masque l'URL derrière
      // une redirection : le titre est alors la seule origine lisible.
      const titleDomain =
        title && /\.[a-z]{2,}$/i.test(title) ? title.replace(/^www\./i, "").toLowerCase() : "";
      const domain = titleDomain || domainOf(url);
      const dedupeKey = domain || url;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      sources.push({ title, url, domain });
    }

    geoLog(`${label} — résultat`, { sourcesGrounding: sources.length });
    return { data: parsed.data, sources };
  } catch (error) {
    geoLog(`${label} — échec`, String(error));
    return null;
  }
}
