/**
 * Le serveur MCP got_the_ref, et comment on l'installe dans chaque agent.
 *
 * MCP (Model Context Protocol) est la prise standard entre un agent IA et un
 * service. En installant celle-ci, l'agent du client — Claude Code, Codex,
 * Cursor, Hermes — cesse d'attendre qu'on lui colle un prompt : il relève
 * lui-même le statut du compte et les correctifs, puis les applique.
 *
 * Le fichier ne contient que des données : il est lu par la modale de
 * rattachement comme par la page d'appairage.
 */

/** Le paquet npm exécuté par l'agent. `npx` le récupère à la volée. */
export const MCP_PACKAGE = "got-the-ref-mcp";

/** Le nom sous lequel le serveur apparaît dans la configuration de l'agent. */
export const MCP_SERVER_NAME = "got_the_ref";

/** L'agent d'exécution activé une fois la connexion faite. */
export const MCP_AGENT_NAME = "got_the_ref";

/** Le bloc de configuration MCP, pour les agents qui se règlent par fichier. */
export const MCP_JSON_SNIPPET = `{
  "mcpServers": {
    "${MCP_SERVER_NAME}": {
      "command": "npx",
      "args": ["-y", "${MCP_PACKAGE}"]
    }
  }
}`;

export type McpAgentId = "claude" | "codex" | "cursor" | "hermes";

export type McpAgentSetup = {
  id: McpAgentId;
  name: string;
  /** `cli` : une commande à taper. `json` : un bloc à coller dans un fichier. */
  kind: "cli" | "json";
  /** La commande ou le bloc, tel qu'on le copie. */
  snippet: string;
  /** Où le poser — nom du fichier pour les agents qui se règlent à la main. */
  where: string;
};

/**
 * Les quatre agents pris en charge.
 *
 * Claude Code et Codex enregistrent un serveur MCP par une commande ; Cursor et
 * Hermes le lisent dans un fichier de configuration. On donne à chacun sa forme
 * réelle plutôt qu'un tronc commun approximatif : une commande qui échoue coûte
 * plus cher qu'un onglet de plus.
 */
export const MCP_AGENTS: readonly McpAgentSetup[] = [
  {
    id: "claude",
    name: "Claude Code",
    kind: "cli",
    snippet: `claude mcp add ${MCP_SERVER_NAME} -- npx -y ${MCP_PACKAGE}`,
    where: "Dans votre terminal",
  },
  {
    id: "codex",
    name: "Codex",
    kind: "cli",
    snippet: `codex mcp add ${MCP_SERVER_NAME} -- npx -y ${MCP_PACKAGE}`,
    where: "Dans votre terminal",
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: "json",
    snippet: MCP_JSON_SNIPPET,
    where: "Dans ~/.cursor/mcp.json",
  },
  {
    id: "hermes",
    name: "Hermes",
    kind: "json",
    snippet: MCP_JSON_SNIPPET,
    where: "Dans la configuration MCP de Hermes",
  },
] as const;

/**
 * La phrase à dire à l'agent une fois la prise installée. Elle déclenche
 * l'appairage : l'agent affiche un code, le client le confirme ici.
 */
export const MCP_FIRST_PROMPT = `Connecte-toi à ${MCP_SERVER_NAME} et applique mes correctifs.`;

/**
 * Le nombre d'étapes de la connexion, dans l'ordre : installer la prise,
 * autoriser l'agent, le laisser travailler. La modale en fait un rail.
 */
export const MCP_STEPS = ["installer", "autoriser", "corriger"] as const;
export type McpStep = (typeof MCP_STEPS)[number];
