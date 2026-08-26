import "server-only";

/**
 * Logger de debug des appels modèles (DeepSeek, Moonshot).
 *
 * Même esprit que `geoLog` : une ligne par étape dans le terminal serveur, sans
 * jamais recracher le prompt entier. On trace ce qui manque quand un appel
 * échoue — modèle, durée, statut HTTP, raison d'arrêt, tokens consommés,
 * début de la réponse — parce qu'un « réponse vide » sans ces chiffres
 * n'apprend rien. Couper avec AI_DEBUG="false".
 */
const ON = process.env.AI_DEBUG !== "false";

export function aiLog(section: string, payload?: unknown): void {
  if (!ON) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`\n🔵 [IA ${ts}] ${section}`);
  if (payload === undefined) return;
  if (typeof payload === "string") console.log(`   ${payload}`);
  else console.dir(payload, { depth: 4, colors: false });
}

/**
 * Le prompt entier, tel qu'il part chez le fournisseur.
 *
 * Coupé par défaut : ces textes font des milliers de caractères et noieraient
 * le terminal à chaque appel. Mettre AI_DEBUG_PROMPTS="true" pour les voir et
 * les rejouer à la main dans la console du fournisseur — c'est le seul moyen
 * de savoir ce que le modèle a réellement reçu, plutôt que ce qu'on croit lui
 * avoir envoyé.
 */
export const PROMPTS_ON = process.env.AI_DEBUG_PROMPTS === "true";

export function aiLogPrompt(label: string, system: string, prompt: string): void {
  if (!PROMPTS_ON) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`\n🟣 [IA ${ts}] ${label} — prompt envoyé`);
  console.log("──────── system ────────");
  console.log(system);
  console.log("──────── user ────────");
  console.log(prompt);
  console.log("────────────────────────");
}
