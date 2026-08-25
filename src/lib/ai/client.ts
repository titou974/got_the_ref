import "server-only";

import type { ZodType } from "zod";
import { AppError } from "@/lib/errors";

/**
 * Les modèles qui font tourner l'accueil client.
 *
 * DeepSeek V4 Flash mène : c'est le moins cher des deux au token (env. 0,22 $
 * l'entrée contre 0,95 $ pour le Kimi de service), il rend du JSON strict et
 * encaisse le million de tokens de contexte qu'un crawl complet représente.
 * Kimi (Moonshot) reste branché en second : même dialecte d'API — les deux
 * exposent le format OpenAI — donc bascule sans réécrire un appel.
 *
 * L'ordre se règle par `AI_PROVIDER` ; le fournisseur restant sert de secours,
 * mais seulement s'il a une clé. Sans clé nulle part, on échoue franchement
 * plutôt que d'inventer une réponse : l'accueil client repose sur ces retours.
 *
 * Chaque fournisseur expose deux modèles, et le choix se fait par appel : le
 * rapide pour ce qui relève de l'extraction — lire un site, en tirer une niche,
 * reformuler un titre —, le puissant pour ce qui relève du jugement. L'audit
 * complet est du second genre : ses notes et ses constats sont ce que le client
 * paie, et un raisonnement court s'y voit tout de suite.
 */
export type AiProvider = "deepseek" | "moonshot";

/** Rapide et bon marché, ou lent et plus fin. Le défaut reste le rapide. */
export type AiTier = "fast" | "strong";

type ProviderConfig = {
  baseUrl: string;
  defaultModel: string;
  /** Le grand modèle du même fournisseur, pour les appels de jugement. */
  defaultStrongModel: string;
  apiKey?: string;
  model?: string;
  strongModel?: string;
};

const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    defaultModel: "deepseek-v4-flash",
    defaultStrongModel: "deepseek-v4-pro",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL,
    strongModel: process.env.DEEPSEEK_STRONG_MODEL,
  },
  moonshot: {
    baseUrl: process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1",
    defaultModel: "kimi-k2.6",
    defaultStrongModel: "kimi-k2.6-thinking",
    apiKey: process.env.MOONSHOT_API_KEY,
    model: process.env.MOONSHOT_MODEL,
    strongModel: process.env.MOONSHOT_STRONG_MODEL,
  },
};

/** Le modèle à employer pour ce fournisseur et ce niveau d'exigence. */
function modelFor(config: ProviderConfig, tier: AiTier): string {
  return tier === "strong"
    ? config.strongModel || config.defaultStrongModel
    : config.model || config.defaultModel;
}

const DEFAULT_PROVIDER: AiProvider =
  process.env.AI_PROVIDER === "moonshot" ? "moonshot" : "deepseek";

/**
 * Le budget d'un appel, par palier.
 *
 * Le grand modèle raisonne avant de répondre et rend jusqu'à seize mille tokens
 * d'audit : les cent vingt secondes taillées pour le Flash le coupaient en
 * plein milieu. Le plafond reste sous les trois cents secondes des routes
 * concernées, secours compris — un premier fournisseur qui dépasse son budget
 * doit laisser au second de quoi répondre.
 */
const TIMEOUT_MS: Record<AiTier, number> = {
  fast: 120_000,
  strong: 145_000,
};

/** Vrai dès qu'au moins un fournisseur a sa clé : sinon, rien à tenter. */
export const isAiConfigured = (): boolean =>
  Object.values(PROVIDERS).some((p) => Boolean(p.apiKey));

/** L'ordre d'essai : le fournisseur demandé d'abord, l'autre en secours. */
function providerOrder(preferred?: AiProvider): AiProvider[] {
  const first = preferred ?? DEFAULT_PROVIDER;
  const second: AiProvider = first === "deepseek" ? "moonshot" : "deepseek";
  return [first, second].filter((name) => Boolean(PROVIDERS[name].apiKey));
}

type ChatOptions = {
  system: string;
  prompt: string;
  /** Fournisseur imposé pour cet appel (sinon `AI_PROVIDER`). */
  provider?: AiProvider;
  /** Niveau de modèle attendu pour cet appel (sinon le rapide). */
  tier?: AiTier;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Un aller-retour vers un fournisseur, en mode JSON.
 *
 * `response_format: json_object` est honoré par les deux API et nous épargne
 * les préambules du genre « Voici le JSON demandé » — mais un modèle peut
 * encore l'entourer d'un bloc de code, d'où le nettoyage au retour.
 */
async function callProvider(name: AiProvider, options: ChatOptions): Promise<string> {
  const config = PROVIDERS[name];
  const tier = options.tier ?? "fast";
  const model = modelFor(config, tier);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[tier]);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
        response_format: { type: "json_object" },
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4000,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`${name}/${model} ${response.status} ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${name}/${model} : réponse vide`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Retire l'éventuel enrobage ```json … ``` et isole le premier objet JSON. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return body;
  return body.slice(start, end + 1);
}

/**
 * Interroge le modèle et valide sa réponse contre un schéma Zod.
 *
 * La validation n'est pas une politesse : ces réponses alimentent directement
 * la fiche client. Un champ manquant vaut mieux détecté ici qu'affiché plus
 * tard sous forme de « undefined » dans une étape du tunnel.
 */
export async function askJson<T>(
  schema: ZodType<T>,
  options: ChatOptions,
): Promise<T> {
  const order = providerOrder(options.provider);
  if (order.length === 0) {
    throw new AppError(
      "L'analyse automatique est momentanément indisponible.",
      "AI_NOT_CONFIGURED",
      503,
    );
  }

  let lastError: unknown = null;

  for (const name of order) {
    try {
      const raw = await callProvider(name, options);
      const parsed = schema.safeParse(JSON.parse(extractJson(raw)));
      if (parsed.success) return parsed.data;
      lastError = new Error(`${name} : réponse hors schéma — ${parsed.error.message}`);
    } catch (error) {
      lastError = error;
    }
  }

  console.error("[ai] tous les fournisseurs ont échoué", lastError);
  throw new AppError(
    "L'analyse automatique n'a rien pu produire. Réessayez dans un instant.",
    "AI_FAILED",
    502,
  );
}
