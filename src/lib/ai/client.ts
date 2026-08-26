import "server-only";

import type { ZodType } from "zod";
import { AppError } from "@/lib/errors";
import { aiLog, aiLogPrompt } from "./log";

/**
 * Les modèles qui font tourner l'accueil client.
 *
 * Trois fournisseurs, deux dialectes d'API. OpenAI répond sur l'API Responses ;
 * DeepSeek et Moonshot parlent le format « chat completions ». Le client
 * masque la différence : un appel se décrit par un palier, jamais par une URL.
 *
 * Le partage du travail vient d'une mesure, pas d'une préférence. Sur le même
 * prompt de tonalité (12 000 caractères, 2 644 tokens d'entrée) :
 * `deepseek-v4-pro` rend sa réponse en 31 secondes après 2 004 tokens de
 * réflexion, `gpt-5.4-mini` en 2,2 secondes et `gpt-5.4-nano` en 3,6. Sur
 * l'audit complet, DeepSeek dépassait carrément les 145 secondes de budget.
 * Tout ce qui relève du jugement part donc chez OpenAI, et DeepSeek reste en
 * secours et sur les extractions bon marché.
 *
 * Sans clé nulle part, on échoue franchement plutôt que d'inventer une
 * réponse : l'accueil client repose sur ces retours.
 */
export type AiProvider = "openai" | "deepseek" | "moonshot";

/** Rapide et bon marché, ou lent et plus fin. Le défaut reste le rapide. */
export type AiTier = "fast" | "strong";

/** Le dialecte HTTP du fournisseur. */
type ProviderApi = "responses" | "chat";

type ProviderConfig = {
  baseUrl: string;
  /** Le dialecte à parler : `responses` chez OpenAI, `chat` chez les autres. */
  api: ProviderApi;
  defaultModel: string;
  /** Le grand modèle du même fournisseur, pour les appels de jugement. */
  defaultStrongModel: string;
  apiKey?: string;
  model?: string;
  strongModel?: string;
  /**
   * Les paliers dont le modèle réfléchit avant de répondre. La réflexion
   * s'impute sur le budget de sortie : ces paliers reçoivent une marge.
   */
  reasoningTiers: AiTier[];
  /** Effort de réflexion demandé (API Responses uniquement). */
  effort?: "minimal" | "low" | "medium" | "high";
  /** Le nom de la variable d'environnement, pour un message d'erreur utile. */
  keyName: string;
};

const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  openai: {
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    api: "responses",
    // Nano lit et extrait, mini juge. Les deux réfléchissent, mais en effort
    // « low » leur réflexion tient en quelques dizaines de tokens.
    defaultModel: "gpt-5.4-nano",
    defaultStrongModel: "gpt-5.4-mini",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_FAST_MODEL,
    strongModel: process.env.OPENAI_STRONG_MODEL,
    reasoningTiers: ["fast", "strong"],
    effort: "low",
    keyName: "OPENAI_API_KEY",
  },
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    api: "chat",
    defaultModel: "deepseek-v4-flash",
    defaultStrongModel: "deepseek-v4-pro",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL,
    strongModel: process.env.DEEPSEEK_STRONG_MODEL,
    reasoningTiers: ["strong"],
    keyName: "DEEPSEEK_API_KEY",
  },
  moonshot: {
    baseUrl: process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1",
    api: "chat",
    defaultModel: "kimi-k2.6",
    defaultStrongModel: "kimi-k2.6-thinking",
    apiKey: process.env.MOONSHOT_API_KEY,
    model: process.env.MOONSHOT_MODEL,
    strongModel: process.env.MOONSHOT_STRONG_MODEL,
    reasoningTiers: ["strong"],
    keyName: "MOONSHOT_API_KEY",
  },
};

/** Le modèle à employer pour ce fournisseur et ce niveau d'exigence. */
function modelFor(config: ProviderConfig, tier: AiTier): string {
  return tier === "strong"
    ? config.strongModel || config.defaultStrongModel
    : config.model || config.defaultModel;
}

/**
 * Qui répond en premier, selon la nature de l'appel.
 *
 * L'extraction (lire un site, en tirer une niche) part chez DeepSeek Flash :
 * c'est le moins cher au token et il ne réfléchit pas. Le jugement (audit,
 * tonalité, rédaction) part chez OpenAI, qui rend la même qualité en quelques
 * secondes là où DeepSeek Pro en demandait des dizaines. `AI_PROVIDER` force
 * le premier essai pour les deux, quand on veut comparer.
 */
const FORCED_PROVIDER: AiProvider | null =
  process.env.AI_PROVIDER === "moonshot"
    ? "moonshot"
    : process.env.AI_PROVIDER === "openai"
      ? "openai"
      : process.env.AI_PROVIDER === "deepseek"
        ? "deepseek"
        : null;

const EXTRACTION_PROVIDER: AiProvider = "deepseek";
const JUDGEMENT_PROVIDER: AiProvider = "openai";

/**
 * Le budget d'un appel, par palier.
 *
 * Le grand modèle raisonne avant de répondre et rend jusqu'à seize mille tokens
 * d'audit : cent quarante-cinq secondes le coupaient en pleine rédaction, et le
 * repli sur le modèle rapide sauvait l'affichage au prix d'un audit moins fin.
 * Quatre minutes lui laissent finir. Ce plafond ne vaut que si un appel ne peut
 * pas les dépenser deux fois : c'est le rôle de `TOTAL_BUDGET_MS`.
 */
const TIMEOUT_MS: Record<AiTier, number> = {
  fast: 120_000,
  strong: 240_000,
};

/**
 * Le temps total qu'une question a le droit de prendre, tous essais confondus.
 *
 * Les routes concernées déclarent `maxDuration = 300`. Passé ce délai, la
 * plateforme coupe la requête et le client ne voit rien : mieux vaut rendre un
 * audit du modèle rapide à la deux-cent-quatre-vingtième seconde qu'une page
 * blanche à la trois-centième. Chaque essai reçoit donc le plus petit de son
 * budget de palier et du temps qui reste.
 */
const TOTAL_BUDGET_MS = 285_000;

/** En dessous, un essai n'a pas le temps d'aboutir : autant le dire et s'arrêter. */
const MIN_ATTEMPT_MS = 15_000;

/**
 * La marge de raisonnement du grand modèle.
 *
 * `max_tokens` borne TOUT ce que le modèle produit, raisonnement compris. Sur
 * `deepseek-v4-pro`, la réflexion consomme couramment trois cents à deux mille
 * tokens avant le premier caractère de réponse : un appel réglé sur neuf cents
 * tokens rendait un contenu vide avec `finish_reason: "length"`, la réflexion
 * ayant tout mangé. Les appelants dimensionnent leur budget pour la réponse
 * qu'ils attendent ; la marge est ajoutée ici, une bonne fois, plutôt que
 * dupliquée dans chaque prompt.
 */
const REASONING_HEADROOM = 3_000;

/**
 * Le plafond de sortie que l'API accepte. La marge de raisonnement ne doit pas
 * pousser un gros appel au-delà : l'audit complet demande déjà seize mille
 * tokens, et une valeur refusée vaudrait une erreur 400 sur tous les audits.
 */
const MAX_OUTPUT_TOKENS = 16_000;

/** Le budget de sortie réellement envoyé : la réponse attendue, plus la réflexion. */
function budgetFor(config: ProviderConfig, tier: AiTier, maxTokens: number): number {
  if (!config.reasoningTiers.includes(tier)) return maxTokens;
  return Math.min(maxTokens + REASONING_HEADROOM, Math.max(maxTokens, MAX_OUTPUT_TOKENS));
}

/** Vrai dès qu'au moins un fournisseur a sa clé : sinon, rien à tenter. */
export const isAiConfigured = (): boolean =>
  Object.values(PROVIDERS).some((p) => Boolean(p.apiKey));

/** L'ordre d'essai : le fournisseur attendu d'abord, les autres en secours. */
function providerOrder(tier: AiTier, preferred?: AiProvider): AiProvider[] {
  const first =
    preferred ??
    FORCED_PROVIDER ??
    (tier === "strong" ? JUDGEMENT_PROVIDER : EXTRACTION_PROVIDER);
  const rest: AiProvider[] = (["openai", "deepseek", "moonshot"] as AiProvider[]).filter(
    (name) => name !== first,
  );
  return [first, ...rest].filter((name) => Boolean(PROVIDERS[name].apiKey));
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

/** Ce que l'API « chat completions » renvoie (DeepSeek, Moonshot). */
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

/** Ce que l'API Responses renvoie (OpenAI). */
type ResponsesPayload = {
  status?: string;
  output_text?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  incomplete_details?: { reason?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string; type?: string; code?: string };
};

/**
 * Une réponse de fournisseur, ramenée à ce dont la suite a besoin.
 *
 * `finish` vaut « length » des deux côtés quand le budget de sortie a été
 * atteint : l'API Responses appelle ça `incomplete_details.reason =
 * max_output_tokens`, on le traduit ici pour que les logs et les causes
 * d'échec ne dépendent pas du fournisseur.
 */
type ProviderReply = {
  content: string | undefined;
  reasoningChars: number;
  finish: string | undefined;
  promptTokens: number | null;
  responseTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  errorMessage: string | undefined;
};

function readChatReply(payload: ChatPayload): ProviderReply {
  const choice = payload.choices?.[0];
  const usage = payload.usage;
  return {
    content: choice?.message?.content,
    reasoningChars: choice?.message?.reasoning_content?.length ?? 0,
    finish: choice?.finish_reason,
    promptTokens: usage?.prompt_tokens ?? null,
    responseTokens: usage?.completion_tokens ?? null,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    errorMessage: payload.error?.message,
  };
}

function readResponsesReply(payload: ResponsesPayload): ProviderReply {
  // `output_text` est une commodité des SDK : la réponse HTTP brute ne le porte
  // pas. Le texte vit dans les blocs `output_text` du message, à côté d'un bloc
  // de réflexion qu'il ne faut surtout pas concaténer à la réponse.
  const fromBlocks = (payload.output ?? [])
    .filter((item) => item.type === "message" || item.type === undefined)
    .flatMap((item) => item.content ?? [])
    .filter((block) => block.type === "output_text" || block.type === undefined)
    .map((block) => block.text)
    .filter((text): text is string => Boolean(text))
    .join("\n");
  const usage = payload.usage;
  const truncated = payload.incomplete_details?.reason === "max_output_tokens";
  return {
    content: payload.output_text || fromBlocks || undefined,
    reasoningChars: 0,
    finish: truncated ? "length" : payload.status,
    promptTokens: usage?.input_tokens ?? null,
    responseTokens: usage?.output_tokens ?? null,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    errorMessage: payload.error?.message,
  };
}

/**
 * Un aller-retour vers un fournisseur, en mode JSON.
 *
 * Les deux dialectes savent imposer un objet JSON en sortie, ce qui nous
 * épargne les préambules du genre « Voici le JSON demandé » — mais un modèle
 * peut encore l'entourer d'un bloc de code, d'où le nettoyage au retour.
 *
 * Chaque étape est tracée : sans la raison d'arrêt ni les tokens consommés,
 * une réponse vide reste une énigme. Le cas fréquent sur un modèle qui
 * raisonne est un arrêt en « length » — le budget de sortie est parti dans la
 * réflexion, il ne reste rien pour la réponse. Le log le dit explicitement.
 */
async function callProvider(
  name: AiProvider,
  options: ChatOptions,
  tierOverride?: AiTier,
  budgetMs?: number,
): Promise<string> {
  const config = PROVIDERS[name];
  const tier = tierOverride ?? options.tier ?? "fast";
  const model = modelFor(config, tier);
  const wanted = options.maxTokens ?? 4000;
  const maxTokens = budgetFor(config, tier, wanted);
  const timeoutMs = Math.min(TIMEOUT_MS[tier], budgetMs ?? TIMEOUT_MS[tier]);
  const label = `${name}/${model}`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = Date.now();

  const url =
    config.api === "responses"
      ? `${config.baseUrl}/responses`
      : `${config.baseUrl}/chat/completions`;

  // L'API Responses porte la consigne système dans `instructions` et le budget
  // dans `max_output_tokens`. Les modèles gpt-5 refusent `temperature` : leur
  // réglage équivalent est l'effort de réflexion.
  const body =
    config.api === "responses"
      ? {
          model,
          instructions: options.system,
          input: options.prompt,
          text: { format: { type: "json_object" } },
          reasoning: { effort: config.effort ?? "low" },
          max_output_tokens: maxTokens,
        }
      : {
          model,
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.prompt },
          ],
          response_format: { type: "json_object" },
          temperature: options.temperature ?? 0.2,
          max_tokens: maxTokens,
          stream: false,
        };

  aiLog(`${label} (${tier}) — appel…`, {
    api: config.api,
    systemeCaracteres: options.system.length,
    promptCaracteres: options.prompt.length,
    reponseAttendueTokens: wanted,
    budgetSortieEnvoye: maxTokens,
    margeRaisonnement: maxTokens - wanted,
    effortOuTemperature:
      config.api === "responses" ? (config.effort ?? "low") : (options.temperature ?? 0.2),
    budgetTimeoutMs: timeoutMs,
    urlBase: config.baseUrl,
  });
  aiLogPrompt(label, options.system, options.prompt);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
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
            ? `clé API refusée (${config.keyName})`
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

    const payload = await response.json();
    const reply =
      config.api === "responses"
        ? readResponsesReply(payload as ResponsesPayload)
        : readChatReply(payload as ChatPayload);

    aiLog(`${label} — ← réponse en ${ms} ms (HTTP ${response.status})`, {
      finishReason: reply.finish ?? "(absent)",
      contenuCaracteres: reply.content?.length ?? 0,
      raisonnementCaracteres: reply.reasoningChars,
      tokens: {
        prompt: reply.promptTokens,
        reponse: reply.responseTokens,
        raisonnement: reply.reasoningTokens,
        total: reply.totalTokens,
        plafond: maxTokens,
      },
      apercu: reply.content ? reply.content.slice(0, 240) : "(vide)",
    });

    if (!reply.content) {
      const cause =
        reply.finish === "length"
          ? `budget de sortie (${maxTokens}) atteint${
              reply.reasoningTokens ? " — la réflexion a tout consommé" : ""
            } : relever maxTokens pour cet appel`
          : reply.finish === "content_filter"
            ? "réponse bloquée par le filtre de contenu du fournisseur"
            : reply.errorMessage
              ? `erreur API : ${reply.errorMessage}`
              : "le fournisseur a répondu sans contenu";
      aiLog(`${label} — ❌ réponse vide`, {
        cause,
        finishReason: reply.finish ?? "(absent)",
      });
      throw new Error(`${label} : réponse vide (${cause})`);
    }

    if (reply.finish === "length") {
      aiLog(`${label} — ⚠️ réponse tronquée (budget de sortie atteint)`, {
        consequence: "le JSON est probablement incomplet — parse impossible",
        piste: `relever maxTokens (actuel ${maxTokens})`,
      });
    }

    return reply.content;
  } catch (error) {
    const ms = Date.now() - startedAt;
    if (timedOut || (error as Error)?.name === "AbortError") {
      aiLog(`${label} — ⏱️ TIMEOUT après ${ms} ms`, {
        budgetMs: timeoutMs,
        plafondDuPalier: TIMEOUT_MS[tier],
        borneParLeBudgetGlobal: timeoutMs < TIMEOUT_MS[tier],
        piste:
          timeoutMs < TIMEOUT_MS[tier]
            ? "il ne restait plus que ce temps sur les 285 s de la question : c'est l'essai précédent qui a tout consommé"
            : "modèle qui raisonne + gros prompt : raccourcir le prompt ou réduire la sortie attendue",
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
  const tier = options.tier ?? "fast";
  const order = providerOrder(tier, options.provider);
  if (order.length === 0) {
    aiLog("❌ aucun fournisseur configuré", {
      piste: "renseigner OPENAI_API_KEY, DEEPSEEK_API_KEY ou MOONSHOT_API_KEY",
    });
    throw new AppError(
      "L'analyse automatique est momentanément indisponible.",
      "AI_NOT_CONFIGURED",
      503,
    );
  }

  // Un essai par (fournisseur, palier). Quand un appel de jugement échoue, le
  // modèle rapide du même fournisseur reprend la question avant qu'on change de
  // fournisseur : il ne raisonne pas, donc il ne dépasse ni son budget de
  // tokens ni celui de temps. Une réponse un peu moins fine vaut mieux qu'une
  // carte vide dans le tableau de bord.
  const attempts = order.flatMap((name) =>
    tier === "strong"
      ? [
          { name, tier: "strong" as AiTier },
          { name, tier: "fast" as AiTier },
        ]
      : [{ name, tier }],
  );

  aiLog(
    `plan d'essai : ${attempts.map((a) => `${a.name}/${modelFor(PROVIDERS[a.name], a.tier)}`).join(" → ")}`,
    {
      budgetGlobalMs: TOTAL_BUDGET_MS,
      plafondParEssaiMs: attempts.map((a) => TIMEOUT_MS[a.tier]),
      ...(order.length === 1
        ? {
            piste:
              "un seul fournisseur a sa clé : après le repli sur le modèle rapide, il n'y a plus rien. Ajouter MOONSHOT_API_KEY pour un vrai secours.",
          }
        : {}),
    },
  );

  let lastError: unknown = null;
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const [index, attempt] of attempts.entries()) {
    const label = `${attempt.name}/${modelFor(PROVIDERS[attempt.name], attempt.tier)}`;
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      aiLog(`${label} — essai abandonné, budget global épuisé`, {
        resteMs: Math.max(0, remaining),
        budgetGlobalMs: TOTAL_BUDGET_MS,
        piste:
          "la route coupe à 300 s : un essai de moins de quinze secondes n'aboutirait pas.",
      });
      break;
    }
    try {
      const raw = await callProvider(attempt.name, options, attempt.tier, remaining);
      const parsed = schema.safeParse(parseJson(label, raw));
      if (parsed.success) {
        if (attempt.tier !== tier) {
          aiLog(`${label} — ✅ réponse obtenue par repli sur le modèle rapide`);
        }
        return parsed.data;
      }
      aiLog(`${label} — ❌ réponse hors schéma`, {
        champs: parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`),
      });
      lastError = new Error(
        `${attempt.name} : réponse hors schéma — ${parsed.error.message}`,
      );
    } catch (error) {
      lastError = error;
    }
    const next = attempts[index + 1];
    if (next) {
      aiLog(
        next.name === attempt.name
          ? `repli sur le modèle rapide de ${attempt.name} après l'échec de ${label}`
          : `bascule sur le fournisseur ${next.name} après l'échec de ${label}`,
      );
    }
  }

  aiLog("❌ tous les essais ont échoué", {
    essayes: attempts.map((a) => `${a.name}/${modelFor(PROVIDERS[a.name], a.tier)}`),
    derniereErreur: String(lastError),
  });
  console.error("[ai] tous les fournisseurs ont échoué", lastError);
  throw new AppError(
    "L'analyse automatique n'a rien pu produire. Réessayez dans un instant.",
    "AI_FAILED",
    502,
  );
}
