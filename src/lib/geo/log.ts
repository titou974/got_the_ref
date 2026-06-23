import "server-only";

/**
 * Logger de debug de l'analyse GEO : trace les étapes en cours et les résultats
 * dans le terminal serveur (`next dev`). Volontairement léger (pas de dump des
 * prompts). Activé par défaut ; mettre GEO_DEBUG="false" pour le couper.
 */
const ON = process.env.GEO_DEBUG !== "false";

/** Une ligne d'étape + données éventuelles (objet court ou texte). */
export function geoLog(section: string, payload?: unknown): void {
  if (!ON) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`\n🟢 [GEO ${ts}] ${section}`);
  if (payload === undefined) return;
  if (typeof payload === "string") console.log(`   ${payload}`);
  else console.dir(payload, { depth: 4, colors: false });
}
