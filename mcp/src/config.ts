/**
 * Où parler, sous quel nom, et où ranger la clé.
 */

/** L'adresse de la plateforme. Surchargée en développement. */
export const API_URL = (
  process.env.GOT_THE_REF_URL ?? "https://gotheref.com"
).replace(/\/+$/, "");

/** Le nom du serveur MCP tel que l'agent l'enregistre. */
export const SERVER_NAME = "got_the_ref";

export const SERVER_VERSION = "0.1.0";

/**
 * Le nom de l'agent qui nous exécute, tel qu'il sera montré au client sur
 * l'écran d'autorisation.
 *
 * On le devine à partir des variables que chaque agent pose dans
 * l'environnement de ses processus. Le but n'est pas d'être exact à tous les
 * coups — c'est que le client reconnaisse ce qu'il autorise. En dernier
 * recours, « agent » : mieux vaut un nom vague qu'un nom faux.
 */
export function detectClientName(): string {
  if (process.env.GOT_THE_REF_CLIENT) return process.env.GOT_THE_REF_CLIENT;
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) return "Claude Code";
  if (process.env.CODEX_SANDBOX || process.env.CODEX_HOME) return "Codex";
  if (process.env.CURSOR_TRACE_ID || process.env.TERM_PROGRAM === "cursor") return "Cursor";
  if (process.env.HERMES_HOME || process.env.HERMES_SESSION) return "Hermes";
  return "agent";
}
