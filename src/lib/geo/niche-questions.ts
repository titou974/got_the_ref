import "server-only";

import { z } from "zod";
import { askJson } from "@/lib/ai/client";
import { geoLog } from "./log";

/**
 * Les questions tapées sous les yeux du client pendant que son audit tourne.
 *
 * L'écran d'attente montre un clavier et une barre de recherche où une question
 * s'écrit lettre à lettre, dans ChatGPT puis Perplexity puis Gemini puis Claude.
 * Les questions étaient jusqu'ici composées à partir de gabarits locaux
 * (`loading-prompts`) : correctes, mais toujours les mêmes tournures, et le
 * client qui attend trois minutes finit par les reconnaître. Elles sont donc
 * écrites par DeepSeek Flash à partir de ce que le crawl a déjà appris du
 * commerce — sa niche, sa ville, son nom.
 *
 * C'est un travail de reformulation courte, pas de jugement : le palier rapide
 * suffit, et il est le seul tenable — cet appel est en concurrence directe avec
 * l'audit lui-même pour l'attention du client, et une question qui arrive après
 * la fin de l'attente n'aura jamais été lue.
 *
 * Rien n'en dépend : si le modèle est indisponible, lent ou hors format, le
 * repli local (`fallbackQuestions`, puis les gabarits de `loading-prompts` côté
 * écran) rend des questions correctes. Un écran d'attente n'a pas le droit de
 * faire échouer l'analyse qu'il fait patienter.
 */

/**
 * Combien de questions on demande.
 *
 * Quatre moteurs et une attente d'une à trois minutes : à trois questions, la
 * boucle se répète avant la fin et le client s'en aperçoit. Huit tiennent la
 * durée sans que l'appel ne coûte plus cher qu'un aller-retour.
 */
export const QUESTION_COUNT = 8;

/**
 * Ce que le modèle doit rendre.
 *
 * `niche` est demandée en retour même quand on la lui a donnée : appelé sur un
 * simple domaine — c'est le cas d'un compte dont le crawl n'a rien conclu —,
 * c'est lui qui la déduit.
 */
const schema = z.object({
  niche: z.string().nullable(),
  questions: z.array(z.string()),
});

export type NicheQuestions = {
  /** La niche retenue : celle qu'on lui a passée, ou celle qu'il a déduite. */
  niche: string | null;
  /** Toujours `QUESTION_COUNT` entrées, repli compris. */
  questions: string[];
};

export type NicheQuestionsInput = {
  /** Le domaine analysé. Seul repère certain quand tout le reste est inconnu. */
  domain: string;
  businessName?: string | null;
  niche?: string | null;
  /** Ville ou zone, pour un commerce qui reçoit du public. */
  location?: string | null;
  /** Un commerce physique se cherche « à Lyon » ; un service en ligne, non. */
  isPhysical?: boolean;
};

/**
 * Le nom sous lequel on désigne le commerce dans les questions.
 *
 * À défaut de nom commercial, le domaine sans son extension fait l'affaire :
 * « pizza-luigi.fr » donne « pizza luigi », qui est très probablement ce qu'un
 * client taperait de toute façon.
 */
function nameOf(input: NicheQuestionsInput): string {
  const declared = input.businessName?.trim();
  if (declared) return declared;
  return input.domain
    .replace(/^www\./, "")
    .replace(/\.[a-z.]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

/**
 * Les questions de repli, construites sans modèle.
 *
 * Elles ne sont pas un pis-aller honteux : ce sont les formes que prend
 * réellement la question d'un client — le superlatif, la demande de conseil, la
 * comparaison, et la vérification d'un nom qu'on lui a donné. Le modèle fait
 * mieux parce qu'il connaît le vocabulaire du métier, pas parce que celles-ci
 * seraient fausses.
 */
export function fallbackQuestions(input: NicheQuestionsInput): string[] {
  const name = nameOf(input);
  const niche = input.niche?.trim() || "entreprise";
  const near = input.isPhysical
    ? input.location?.trim()
      ? `à ${input.location.trim()}`
      : "près de moi"
    : "en ligne";

  return [
    `meilleur ${niche} ${near}`,
    `quel ${niche} me recommandes-tu ${near}`,
    `top 5 des ${niche} ${near}`,
    `avis clients sur les ${niche} ${near}`,
    `${name} est-il un bon choix`,
    `que valent les prix de ${name}`,
  ];
}

/**
 * Ramène la réponse du modèle à des questions utilisables.
 *
 * Les modèles ajoutent volontiers une majuscule, un point d'interrogation et
 * des guillemets — trois marques d'une phrase écrite, alors qu'on imite
 * quelqu'un qui tape dans une barre de recherche. On les retire, et on complète
 * avec le repli si le compte n'y est pas.
 */
function normalize(raw: string[], input: NicheQuestionsInput): string[] {
  const cleaned = raw
    .map((question) =>
      question
        .replace(/^\s*[-*\d.)\]]+\s*/, "")
        .replace(/^["'«»\s]+|["'«»\s?.]+$/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim(),
    )
    // Au-delà de ~70 signes, la question déborde de la barre de recherche de
    // l'écran d'attente et se fait tronquer au milieu d'un mot.
    .filter((question) => question.length >= 8 && question.length <= 70);

  const unique = [...new Set(cleaned)];
  if (unique.length >= QUESTION_COUNT) return unique.slice(0, QUESTION_COUNT);

  // Complété par le repli, sans jamais répéter une question déjà retenue.
  for (const question of fallbackQuestions(input)) {
    if (unique.length >= QUESTION_COUNT) break;
    if (!unique.includes(question)) unique.push(question);
  }
  return unique;
}

/**
 * Mémoire courte, par commerce.
 *
 * L'écran d'attente est monté une fois par page du tableau de bord, et le
 * client peut en changer pendant que l'audit tourne. Sans ce cache, chaque
 * montage repayerait le même appel pour la même réponse. Un quart d'heure
 * suffit : au-delà, la niche a pu être affinée par l'audit lui-même, et il vaut
 * mieux redemander.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: NicheQuestions }>();

/**
 * Les questions qu'un client taperait pour trouver ce commerce.
 *
 * Ne jette jamais : l'appelant est un écran d'attente, et le repli est toujours
 * exploitable.
 */
export async function generateNicheQuestions(
  input: NicheQuestionsInput,
): Promise<NicheQuestions> {
  const key = `${input.domain}|${input.niche ?? ""}|${input.location ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const name = nameOf(input);
  const fallback: NicheQuestions = {
    niche: input.niche?.trim() || null,
    questions: fallbackQuestions(input),
  };

  try {
    const answer = await askJson(schema, {
      system:
        "Tu écris des requêtes telles qu'un client les tape dans un assistant IA. " +
        "Style parlé, minuscules, sans ponctuation finale, sans guillemets. " +
        "Jamais de jargon marketing : ce sont les mots d'un particulier pressé.",
      prompt: [
        `Site analysé : ${input.domain}`,
        input.businessName ? `Nom commercial : ${input.businessName}` : "",
        input.niche ? `Niche : ${input.niche}` : "",
        input.location ? `Ville / zone : ${input.location}` : "",
        input.isPhysical
          ? "Ce commerce reçoit du public sur place : ses clients cherchent une adresse."
          : "Ce commerce vend en ligne : ses clients ne cherchent pas d'adresse.",
        "",
        `Écris ${QUESTION_COUNT} questions différentes que de vrais clients poseraient à ChatGPT, Perplexity, Gemini ou Claude et dont la réponse devrait citer ce commerce.`,
        "- Les six premières portent sur la niche, sans nommer le commerce : le client ne le connaît pas encore, il cherche un prestataire.",
        `- Les deux dernières nomment « ${name} » : c'est le client qui vérifie une adresse qu'on lui a conseillée.`,
        "- Varie les intentions : superlatif, conseil, comparatif, avis, prix, horaires.",
        input.isPhysical ? "- Situe les questions de niche sur la ville quand elle est connue." : "",
        "- Moins de 70 caractères chacune.",
        "",
        "Réponds en JSON avec exactement ces clés :",
        '- "niche" : la niche du commerce en quelques mots, déduite du domaine si elle n\'est pas donnée, sinon null.',
        `- "questions" : le tableau des ${QUESTION_COUNT} questions.`,
      ]
        .filter(Boolean)
        .join("\n"),
      // Reformuler court à partir d'une niche : de l'extraction, pas du
      // jugement. DeepSeek Flash, comme le reste des appels non lus tels quels.
      provider: "deepseek",
      tier: "fast",
      maxTokens: 600,
    });

    const value: NicheQuestions = {
      niche: answer.niche?.trim() || fallback.niche,
      questions: normalize(answer.questions, input),
    };
    geoLog("Questions d'attente — ✅ écrites par DeepSeek Flash", value);
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    // L'écran d'attente s'affiche quoi qu'il arrive : on retombe sur le repli
    // et on le note, sans remonter l'erreur à l'audit en cours.
    geoLog("Questions d'attente — ⚠️ repli local", String(error));
    cache.set(key, { at: Date.now(), value: fallback });
    return fallback;
  }
}
