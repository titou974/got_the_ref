import "server-only";

import type { AiEngine } from "./types";
import { geoLog } from "./log";

const FETCH_TIMEOUT_MS = 80000;

export type EngineCitation = {
  rank: number;
  title: string | null;
  url: string;
  domain: string;
};

export type LiveEngineResult = {
  engine: AiEngine;
  available: boolean; // clé présente, appel tenté
  answered: boolean; // réponse exploitable obtenue
  answerText: string;
  rankedItems: string[]; // classement d'établissements lu dans la réponse (1 = premier)
  citations: EngineCitation[];
  error?: string;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Détecte une erreur d'abandon (timeout AbortController ou coupure réseau). */
function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || /aborted|abort/i.test(err.message))
  );
}

export async function postJson(
  url: string,
  init: RequestInit,
  label = "fetch",
): Promise<unknown> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => {
    geoLog(
      `${label} — ⏱️ TIMEOUT atteint (${FETCH_TIMEOUT_MS} ms) → abandon de la requête HTTP`,
    );
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    geoLog(
      `${label} — → requête HTTP envoyée vers ${new URL(url).host} (budget ${FETCH_TIMEOUT_MS} ms)`,
    );
    const res = await fetch(url, { ...init, signal: controller.signal });
    geoLog(
      `${label} — ← réponse reçue en ${Date.now() - startedAt} ms (HTTP ${res.status})`,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    return await res.json();
  } catch (err) {
    const ms = Date.now() - startedAt;
    if (isAbortError(err)) {
      geoLog(
        `${label} — ❌ AbortError après ${ms} ms : la requête a dépassé le budget de ${FETCH_TIMEOUT_MS} ms (connexion lente ou moteur qui tarde).`,
      );
    } else {
      geoLog(`${label} — ❌ échec réseau après ${ms} ms`, String(err));
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function dedupeCitations(raw: EngineCitation[]): EngineCitation[] {
  const seen = new Set<string>();
  const out: EngineCitation[] = [];
  for (const c of raw) {
    const key = c.domain || c.url || c.title || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, rank: out.length + 1 });
  }
  return out;
}

/* --------------------- Lecture du classement (par noms) -------------------- */

/** Nettoie un nom d'établissement extrait d'une ligne de classement. */
function cleanItemName(s: string): string {
  return s
    .replace(/\*\*/g, "") // gras markdown
    .replace(/`/g, "")
    .replace(/\([^)]*\)/g, "") // retire les citations « (guide.michelin.com) »
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s*[–—:]\s.*$/, "") // coupe la colonne « pourquoi » après un tiret/deux-points
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrait la liste ordonnée des établissements depuis le texte de réponse,
 * qu'il soit en liste numérotée (« 1. Nom »), en puces, ou en tableau markdown
 * (« | 1 | Nom | … » / « 1\tNom\t… »). On ne garde que la première cellule (le
 * nom), pas la colonne explicative.
 */
export function parseRankedItems(text: string): string[] {
  if (!text) return [];
  const numbered: { rank: number; name: string }[] = [];
  const bulleted: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Ligne numérotée ou ligne de tableau : « 1. », « 1) », « 1 », « | 1 | »
    const num = line.match(/^\|?\s*(\d{1,2})[.)\-–—|\t ]+(\S.*)$/);
    if (num) {
      const rank = parseInt(num[1], 10);
      if (rank < 1 || rank > 20) continue;
      // première cellule = nom (avant un séparateur de colonne)
      const firstCell = num[2].split(/\s*\|\s*|\t|\s{2,}/)[0] ?? num[2];
      const name = cleanItemName(firstCell);
      if (name.length >= 2) numbered.push({ rank, name });
      continue;
    }

    // Liste à puces (ordre = ordre d'apparition)
    const bullet = line.match(/^[-*•]\s+(\S.*)$/);
    if (bullet) {
      const firstCell = bullet[1].split(/\s*\|\s*|\t|\s{2,}/)[0] ?? bullet[1];
      const name = cleanItemName(firstCell);
      if (name.length >= 2) bulleted.push(name);
    }
  }

  const ordered = numbered.length
    ? numbered.sort((a, b) => a.rank - b.rank).map((i) => i.name)
    : bulleted;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of ordered) {
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out.slice(0, 12);
}

/* --------------------------------- OpenAI --------------------------------- */
/**
 * Reproduit ChatGPT « grand public » avec recherche web : modèle gpt-5.5, outil
 * web_search en contexte « high », AUCUN system/instructions. On bride le coût :
 * reasoning effort « low » et plafond de tokens de sortie. La requête (côté
 * appelant) impose un format de liste minimal qu'on parse en classement.
 */
async function queryOpenAI(query: string): Promise<LiveEngineResult> {
  const engine: AiEngine = "ChatGPT";
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    geoLog("OpenAI — ignoré (pas de clé OPENAI_API_KEY)");
    return {
      engine,
      available: false,
      answered: false,
      answerText: "",
      rankedItems: [],
      citations: [],
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const startedAt = Date.now();
  geoLog(`OpenAI — appel (${model}, web_search)…`, {
    requête: query.slice(0, 200),
    budgetTimeoutMs: FETCH_TIMEOUT_MS,
  });
  try {
    const data = (await postJson(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          tools: [{ type: "web_search", search_context_size: "high" }],
          tool_choice: "auto",
          reasoning: { effort: "medium" },
          max_output_tokens: 2000,
          input: query,
        }),
      },
      "OpenAI/ChatGPT",
    )) as Record<string, unknown>;

    let answerText = (data.output_text as string) ?? "";
    const citations: EngineCitation[] = [];
    const output = (data.output as Array<Record<string, unknown>>) ?? [];
    for (const item of output) {
      const content = (item.content as Array<Record<string, unknown>>) ?? [];
      for (const block of content) {
        if (typeof block.text === "string") {
          // concatène les blocs de texte (le classement vit dans le texte)
          answerText = answerText ? `${answerText}\n${block.text}` : block.text;
        }
        const annotations =
          (block.annotations as Array<Record<string, unknown>>) ?? [];
        for (const a of annotations) {
          const url = a.url as string | undefined;
          if (url) {
            citations.push({
              rank: citations.length + 1,
              title: (a.title as string) ?? null,
              url,
              domain: domainOf(url),
            });
          }
        }
      }
    }

    const rankedItems = parseRankedItems(answerText);
    geoLog("OpenAI — ✅ résultat", {
      tempsTotalMs: Date.now() - startedAt,
      classement: rankedItems,
      sourcesCitées: citations.length,
      aperçuRéponse: answerText.slice(0, 400),
    });
    return {
      engine,
      available: true,
      answered: !!answerText || rankedItems.length > 0,
      answerText,
      rankedItems,
      citations: dedupeCitations(citations),
    };
  } catch (err) {
    const ms = Date.now() - startedAt;
    if (isAbortError(err)) {
      geoLog(
        `OpenAI — ❌ ABANDON (AbortError) après ${ms} ms : timeout de ${FETCH_TIMEOUT_MS} ms dépassé. ` +
          `GPT (web_search + reasoning) est lent ; sur une connexion faible il dépasse souvent ce budget. ` +
          `Piste : augmenter FETCH_TIMEOUT_MS ou réduire reasoning.effort/search_context_size.`,
      );
    } else {
      geoLog(`OpenAI — ❌ échec après ${ms} ms`, String(err));
    }
    return {
      engine,
      available: true,
      answered: false,
      answerText: "",
      rankedItems: [],
      citations: [],
      error: String(err),
    };
  }
}

/* --------------------------------- Gemini --------------------------------- */
/**
 * Reproduit Gemini Flash « grand public » : modèle gemini-flash-latest, grounding
 * Google Search, requête utilisateur seule. On lit le classement dans le texte
 * (même format de liste minimal que pour GPT).
 */
async function queryGemini(query: string): Promise<LiveEngineResult> {
  const engine: AiEngine = "Gemini";
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    geoLog("Gemini — ignoré (pas de clé GEMINI_API_KEY)");
    return {
      engine,
      available: false,
      answered: false,
      answerText: "",
      rankedItems: [],
      citations: [],
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  geoLog(`Gemini — appel (${model}, google_search)…`);
  try {
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
        }),
      },
      "Gemini",
    )) as Record<string, unknown>;

    const candidates = data.candidates as
      | Array<Record<string, unknown>>
      | undefined;
    const cand = candidates?.[0];
    const parts =
      ((cand?.content as Record<string, unknown>)?.parts as Array<{
        text?: string;
      }>) ?? [];
    const answerText = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join("\n");

    const grounding = cand?.groundingMetadata as
      | Record<string, unknown>
      | undefined;
    const chunks =
      (grounding?.groundingChunks as Array<{
        web?: { uri?: string; title?: string };
      }>) ?? [];
    const citations: EngineCitation[] = chunks
      .map((c, i) => {
        const url = c.web?.uri ?? "";
        const title = c.web?.title ?? null;
        const titleDomain =
          title && /\.[a-z]{2,}$/i.test(title)
            ? title.replace(/^www\./, "").toLowerCase()
            : "";
        return {
          rank: i + 1,
          title,
          url,
          domain: titleDomain || domainOf(url),
        };
      })
      .filter((c) => c.url || c.title);

    const rankedItems = parseRankedItems(answerText);
    geoLog("Gemini — résultat", {
      classement: rankedItems,
      sourcesGrounding: citations.length,
      aperçuRéponse: answerText.slice(0, 400),
    });
    return {
      engine,
      available: true,
      answered: !!answerText || rankedItems.length > 0,
      answerText,
      rankedItems,
      citations: dedupeCitations(citations),
    };
  } catch (err) {
    geoLog("Gemini — échec", String(err));
    return {
      engine,
      available: true,
      answered: false,
      answerText: "",
      rankedItems: [],
      citations: [],
      error: String(err),
    };
  }
}

/* ------------------------------ Orchestration ----------------------------- */

/**
 * Y a-t-il au moins une clé moteur configurée ?
 *
 * Deux clés possibles, et deux seulement : ce sont les seuls assistants qui
 * lisent le web avant de répondre. Une clé de modèle de service (DeepSeek) n'a
 * pas sa place ici — elle sert à juger un site, pas à classer un marché.
 */
export function hasAnyEngineKey(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

/**
 * Interroge en parallèle les moteurs configurés sur la requête cible.
 *
 * Les deux moteurs vont chercher leur réponse sur le web : ChatGPT par son
 * outil de recherche, Gemini par le grounding Google Search. Le classement
 * qu'on en tire est donc un relevé, pas une estimation — c'est la seule raison
 * pour laquelle on peut l'afficher comme un top 10.
 */
export async function gatherLiveEngines(
  query: string,
  engines: AiEngine[] = ["ChatGPT", "Gemini"],
): Promise<LiveEngineResult[]> {
  const callers: Record<AiEngine, (q: string) => Promise<LiveEngineResult>> = {
    ChatGPT: queryOpenAI,
    Gemini: queryGemini,
  };
  const wanted = engines.filter((e, i) => engines.indexOf(e) === i);
  const results = await Promise.allSettled(
    wanted.map((e) => callers[e](query)),
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          engine: wanted[i],
          available: true,
          answered: false,
          answerText: "",
          rankedItems: [],
          citations: [],
          error: String(r.reason),
        },
  );
}

/* ------------------------- Mesure de positionnement ----------------------- */

export type MeasuredEngine = {
  engine: AiEngine;
  measured: boolean; // une réponse réelle a été exploitée
  cited: boolean; // le commerce apparaît dans la réponse
  position: number | null; // rang mesuré dans le classement
  competitorsAhead: string[];
  citations: EngineCitation[];
};

/** Construit un test « est-ce le commerce cible ? » à partir du nom + domaine. */
function buildTargetMatcher(targetDomain: string, businessName: string) {
  const domainRoot =
    targetDomain
      .replace(/^www\./, "")
      .split(".")[0]
      ?.toLowerCase() ?? "";
  const nameLc = businessName.trim().toLowerCase();
  return (label: string): boolean => {
    const l = label.toLowerCase();
    if (nameLc.length >= 3 && (l.includes(nameLc) || nameLc.includes(l)))
      return true;
    if (
      domainRoot.length >= 4 &&
      l.replace(/[^a-z0-9]/g, "").includes(domainRoot)
    )
      return true;
    return false;
  };
}

/**
 * À partir d'une réponse réelle d'un moteur, déduit la position du commerce
 * cible dans le classement (par NOM en priorité, sinon par domaine cité) et les
 * concurrents classés avant lui.
 */
export function measureEngine(
  live: LiveEngineResult,
  targetDomain: string,
  businessName: string,
): MeasuredEngine {
  const base: MeasuredEngine = {
    engine: live.engine,
    measured: false,
    cited: false,
    position: null,
    competitorsAhead: [],
    citations: live.citations,
  };
  if (!live.answered) return base;

  const matches = buildTargetMatcher(targetDomain, businessName);
  const nameLc = businessName.trim().toLowerCase();
  const domainRoot =
    targetDomain
      .replace(/^www\./, "")
      .split(".")[0]
      ?.toLowerCase() ?? "";

  let position: number | null = null;
  let ahead: string[] = [];

  // 1) Classement par NOMS lu dans la réponse (cas nominal : top 10 d'établissements)
  if (live.rankedItems.length) {
    const idx = live.rankedItems.findIndex((it) => matches(it));
    if (idx >= 0) {
      position = idx + 1;
      ahead = live.rankedItems.slice(0, idx).slice(0, 3);
    } else {
      // commerce absent du classement : les concurrents = tête de classement
      ahead = live.rankedItems.slice(0, 3);
    }
  } else {
    // 2) Repli : ordre des sources citées (domaines)
    for (const c of live.citations) {
      const label = c.title || c.domain || c.url;
      if (matches(label)) {
        position = c.rank;
        break;
      }
      if (ahead.length < 3) ahead.push(c.title || c.domain || label);
    }
  }

  const citedInText =
    (nameLc.length >= 3 && live.answerText.toLowerCase().includes(nameLc)) ||
    (domainRoot.length >= 4 &&
      live.answerText.toLowerCase().includes(domainRoot));

  return {
    engine: live.engine,
    measured: true,
    cited: position != null || citedInText,
    position,
    competitorsAhead: ahead,
    citations: live.citations,
  };
}
