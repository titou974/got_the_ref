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
