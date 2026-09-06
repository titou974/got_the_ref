import "server-only";

/**
 * Le journal des appels DataForSEO, dans le terminal serveur.
 *
 * Même esprit que `geoLog` et `aiLog` : une ligne par étape, jamais un dump de
 * la réponse. Ce qu'on veut voir ici tient en une question — « est-ce qu'un
 * appel facturé vient de partir, et pourquoi ? » — d'où la trace des deux cas
 * symétriques : la requête envoyée, et le relevé lu en base sans rien appeler.
 * Un appel qu'on ne voit pas passer est un appel qu'on découvre sur la facture.
 *
 * Couper avec DATAFORSEO_DEBUG="false".
 */
const ON = process.env.DATAFORSEO_DEBUG !== "false";

export function dataForSeoLog(section: string, payload?: unknown): void {
  if (!ON) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`\n⚫ [DATAFORSEO ${ts}] ${section}`);
  if (payload === undefined) return;
  if (typeof payload === "string") console.log(`   ${payload}`);
  else console.dir(payload, { depth: 4, colors: false });
}
