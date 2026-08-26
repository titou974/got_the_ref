import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { askJson, isAiConfigured } from "@/lib/ai/client";
import { aiLog } from "@/lib/ai/log";
import { buildSolutionFacts, type SolutionFactsInput } from "@/lib/geo/solution-facts";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";

/**
 * Le prompt de correction, écrit par le modèle mini sur le dossier de l'onglet.
 *
 * Avant, ces prompts étaient des gabarits : le même texte pour tout le monde,
 * avec la liste des contrôles en défaut. Le client lisait « corrigez votre méta
 * description » et devait encore trouver quoi écrire. Désormais `gpt-5.4-mini`
 * rédige l'enrobage — le contexte et les consignes — pendant que le code y
 * recopie la matière exacte : la méta description proposée, le H1 proposé, le
 * fichier absent, l'article déjà rédigé.
 *
 * Le partage est délibéré. Faire recopier la matière au modèle reviendrait à
 * lui demander de restituer mille cinq cents mots de Markdown sans en perdre
 * une balise : il abrège, il reformule, et le client colle un article amputé.
 * Le modèle écrit donc ce qu'il sait faire, et rien de ce qui doit rester
 * intact ne passe entre ses mains.
 *
 * Sans clé d'API — ou si l'appel échoue — le gabarit déterministe reprend la
 * main : une carte de prompt vide serait pire qu'un prompt générique.
 */

const SYSTEM = `Tu écris des prompts destinés à être collés dans un agent IA (Claude Code, ChatGPT, Cursor) par le développeur ou le prestataire d'un commerçant français.

Tu rédiges UNIQUEMENT l'enrobage du prompt, en deux parties :
- "intro" : 2 à 4 phrases à la première personne (« Voici mon site… », « Je veux… ») qui posent le contexte réel du site et la mission. Termine en annonçant que les éléments exacts à appliquer suivent.
- "instructions" : les consignes d'exécution, en 4 à 8 points numérotés, qui disent quoi faire des éléments fournis (où les poser, dans quel fichier, dans quel ordre, quoi vérifier ensuite) et quel format de réponse tu attends de l'agent.

Règles :
- Français, tutoiement de l'agent, ton direct, aucune formule de politesse.
- Ne recopie JAMAIS les textes, balises, fichiers ou articles fournis : ils seront insérés automatiquement entre l'intro et les instructions. Renvoie-y par « les éléments ci-dessus ».
- N'invente aucun fait, aucun chiffre, aucun nom de fichier qui ne soit pas dans le dossier.
- Exige de l'agent qu'il reprenne les textes fournis mot pour mot, sans les réécrire.
- Pas de titres Markdown, pas de gras : du texte simple.

Réponds en JSON : {"intro": "...", "instructions": "..."}.`;

const schema = z.object({
  intro: z.string().min(40),
  instructions: z.string().min(40),
});

/** Le titre du bloc recopié tel quel, entre l'intro et les consignes. */
const DOSSIER_OPEN = "----- ÉLÉMENTS EXACTS À APPLIQUER (ne rien reformuler) -----";
const DOSSIER_CLOSE = "----- FIN DES ÉLÉMENTS -----";

/**
 * Le prompt déjà rédigé pour ce dossier.
 *
 * Une page de tableau de bord se recharge à chaque navigation, et le dossier ne
 * bouge qu'au prochain passage des agents : sans mémoire, on paierait un appel
 * au modèle à chaque aller-retour entre deux onglets. La clé est l'empreinte du
 * dossier — dès qu'un fait change, le prompt est réécrit.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { prompt: string; at: number }>();

function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.prompt;
}

function cacheSet(key: string, prompt: string): void {
  // Map conserve l'ordre d'insertion : la plus ancienne entrée part la première.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { prompt, at: Date.now() });
}

/**
 * Le dossier envoyé au modèle, borné.
 *
 * Un planning de douze articles rédigés pèse plusieurs dizaines de milliers de
 * caractères. Le modèle n'a pas besoin de les lire pour écrire l'enrobage —
 * seulement de savoir ce qu'il y a — et les articles complets partent de toute
 * façon dans le prompt final, sans passer par lui.
 */
const MAX_DOSSIER_CHARS = 6_000;

function summarizeForModel(dossier: string): string {
  if (dossier.length <= MAX_DOSSIER_CHARS) return dossier;
  return `${dossier.slice(0, MAX_DOSSIER_CHARS)}\n\n[…dossier tronqué pour la rédaction : les éléments complets seront insérés automatiquement]`;
}

export async function writeSolutionPrompt(input: SolutionFactsInput): Promise<string> {
  const fallback = () => buildSolutionPrompt(input.tab, input.result, input.diagnostic);
  const { mission, dossier } = buildSolutionFacts(input);

  if (!isAiConfigured()) return fallback();

  const key = `${input.tab}:${createHash("sha1").update(dossier).digest("hex")}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const written = await askJson(schema, {
      system: SYSTEM,
      // Le mot « JSON » doit figurer dans l'entrée elle-même : l'API Responses
      // refuse `text.format: json_object` si seule la consigne système le porte
      // (HTTP 400, « input messages must contain the word json »).
      prompt: `Mission du prompt à écrire : ${mission}.

Dossier de l'onglet « ${input.tab} » (source de vérité, ne rien recopier) :
${summarizeForModel(dossier)}

Réponds en JSON : {"intro": "…", "instructions": "…"}.`,
      // Le mini d'OpenAI : c'est lui qui juge et rédige, en deux secondes.
      provider: "openai",
      tier: "strong",
      maxTokens: 1200,
    });

    const prompt = [
      written.intro.trim(),
      DOSSIER_OPEN,
      dossier.trim(),
      DOSSIER_CLOSE,
      written.instructions.trim(),
    ].join("\n\n");

    cacheSet(key, prompt);
    return prompt;
  } catch (error) {
    aiLog("prompt de correction — repli sur le gabarit déterministe", {
      onglet: input.tab,
      erreur: String(error),
    });
    return fallback();
  }
}
