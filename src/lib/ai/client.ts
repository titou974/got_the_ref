import "server-only";

import type { ZodType } from "zod";
import { AppError } from "@/lib/errors";
import { aiLog } from "./log";

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

/** Ce que l'API nous renvoie, une fois les champs qui nous intéressent nommés. */
type ChatPayload = {
  choices?: {
    message?: { content?: string; reasoning_content?: string };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string; type?: string; code?: string };
};

/**
 * Un aller-retour vers un fournisseur, en mode JSON.
 *
 * `response_format: json_object` est honoré par les deux API et nous épargne
 * les préambules du genre « Voici le JSON demandé » — mais un modèle peut
 * encore l'entourer d'un bloc de code, d'où le nettoyage au retour.
 *
 * Chaque étape est tracée : sans la raison d'arrêt ni les tokens consommés,
 * une réponse vide reste une énigme. Le cas fréquent sur un modèle qui
 * raisonne (`deepseek-v4-pro`) est `finish_reason: "length"` — le budget
 * `max_tokens` part dans le raisonnement, il ne reste rien pour la réponse.
 * Le log le dit alors explicitement.
 */
async function callProvider(name: AiProvider, options: ChatOptions): Promise<string> {
  const config = PROVIDERS[name];
  const tier = options.tier ?? "fast";
  const model = modelFor(config, tier);
  const maxTokens = options.maxTokens ?? 4000;
  const timeoutMs = TIMEOUT_MS[tier];
  const label = `${name}/${model}`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = Date.now();

  aiLog(`${label} (${tier}) — appel…`, {
    systemeCaracteres: options.system.length,
    promptCaracteres: options.prompt.length,
    maxTokens,
    temperature: options.temperature ?? 0.2,
    budgetTimeoutMs: timeoutMs,
    urlBase: config.baseUrl,
  });

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
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    const ms = Date.now() - startedAt;

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      aiLog(`${label} — ❌ HTTP ${response.status} après ${ms} ms`, {
        statut: response.status,
        corps: detail.slice(0, 500),
        piste:
          response.status === 401
            ? "clé API refusée (DEEPSEEK_API_KEY)"
            : response.status === 402
              ? "crédit épuisé côté fournisseur"
              : response.status === 429
                ? "quota ou débit dépassé — réessayer plus tard"
                : response.status >= 500
                  ? "panne côté fournisseur"
                  : "requête refusée (modèle inconnu ? paramètre invalide ?)",
      });
      throw new Error(`${label} ${response.status} ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as ChatPayload;
    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    const reasoning = choice?.message?.reasoning_content;
    const finish = choice?.finish_reason;
    const usage = payload.usage;

    aiLog(`${label} — ← réponse en ${ms} ms (HTTP ${response.status})`, {
      finishReason: finish ?? "(absent)",
      contenuCaracteres: content?.length ?? 0,
      raisonnementCaracteres: reasoning?.length ?? 0,
      tokens: {
        prompt: usage?.prompt_tokens ?? null,
        reponse: usage?.completion_tokens ?? null,
        raisonnement: usage?.completion_tokens_details?.reasoning_tokens ?? null,
        total: usage?.total_tokens ?? null,
        plafond: maxTokens,
      },
      apercu: content ? content.slice(0, 240) : "(vide)",
    });

    if (!content) {
      const cause =
        finish === "length"
          ? `plafond max_tokens (${maxTokens}) atteint${
              reasoning ? " — le raisonnement a tout consommé" : ""
            } : relever maxTokens pour cet appel`
          : finish === "content_filter"
            ? "réponse bloquée par le filtre de contenu du fournisseur"
            : payload.error?.message
              ? `erreur API : ${payload.error.message}`
              : "le fournisseur a renvoyé un choix sans contenu";
      aiLog(`${label} — ❌ réponse vide`, { cause, finishReason: finish ?? "(absent)" });
      throw new Error(`${label} : réponse vide (${cause})`);
    }

    if (finish === "length") {
      aiLog(`${label} — ⚠️ réponse tronquée (finish_reason=length)`, {
        consequence: "le JSON est probablement incomplet — parse impossible",
        piste: `relever maxTokens (actuel ${maxTokens})`,
      });
    }

    return content;
  } catch (error) {
    const ms = Date.now() - startedAt;
    if (timedOut || (error as Error)?.name === "AbortError") {
      aiLog(`${label} — ⏱️ TIMEOUT après ${ms} ms`, {
        budgetMs: timeoutMs,
        piste:
          "modèle qui raisonne + gros prompt : relever TIMEOUT_MS[tier] ou raccourcir le prompt",
      });
      throw new Error(`${label} : timeout après ${timeoutMs} ms`);
    }
    if (!(error as Error)?.message?.startsWith(label)) {
      aiLog(`${label} — ❌ échec réseau après ${ms} ms`, String(error));
    }
    throw error;
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

/** `JSON.parse`, mais qui dit ce qu'on a reçu à la place du JSON attendu. */
function parseJson(label: string, raw: string): unknown {
  const body = extractJson(raw);
  if (!body) {
    aiLog(`${label} — ❌ rien à parser`, {
      brutCaracteres: raw.length,
      apercuBrut: raw.slice(0, 240) || "(chaîne vide)",
    });
    throw new Error(`${label} : réponse sans JSON exploitable`);
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    aiLog(`${label} — ❌ JSON illisible`, {
      erreur: String(error),
      brutCaracteres: raw.length,
      jsonCaracteres: body.length,
      debut: body.slice(0, 200),
      fin: body.slice(-200),
      piste: body.trimEnd().endsWith("}")
        ? "JSON complet mais mal formé"
        : "JSON coupé net — réponse tronquée, relever maxTokens",
    });
    throw new Error(`${label} : JSON illisible — ${String(error)}`);
  }
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
    aiLog("❌ aucun fournisseur configuré", {
      piste: "renseigner DEEPSEEK_API_KEY ou MOONSHOT_API_KEY",
    });
    throw new AppError(
      "L'analyse automatique est momentanément indisponible.",
      "AI_NOT_CONFIGURED",
      503,
    );
  }

  if (order.length === 1) {
    aiLog(`ordre d'essai : ${order.join(" → ")} (aucun secours)`, {
      piste:
        "un seul fournisseur a sa clé : le moindre timeout fait échouer l'appel. Ajouter MOONSHOT_API_KEY pour un vrai secours.",
    });
  } else {
    aiLog(`ordre d'essai : ${order.join(" → ")}`);
  }

  let lastError: unknown = null;

  for (const [index, name] of order.entries()) {
    const label = `${name}/${modelFor(PROVIDERS[name], options.tier ?? "fast")}`;
    try {
      const raw = await callProvider(name, options);
      const parsed = schema.safeParse(parseJson(label, raw));
      if (parsed.success) return parsed.data;
      aiLog(`${label} — ❌ réponse hors schéma`, {
        champs: parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`),
      });
      lastError = new Error(`${name} : réponse hors schéma — ${parsed.error.message}`);
    } catch (error) {
      lastError = error;
    }
    if (index < order.length - 1) {
      aiLog(`bascule sur le fournisseur de secours après l'échec de ${name}`);
    }
  }

  aiLog("❌ tous les fournisseurs ont échoué", {
    essayes: order,
    derniereErreur: String(lastError),
  });
  console.error("[ai] tous les fournisseurs ont échoué", lastError);
  throw new AppError(
    "L'analyse automatique n'a rien pu produire. Réessayez dans un instant.",
    "AI_FAILED",
    502,
  );
}
