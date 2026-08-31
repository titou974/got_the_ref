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

/** Le nom du paquet, tel qu'il est publié sur npm. */
export const MCP_PACKAGE = "got-the-ref-mcp";

/**
 * Ce que `npx` reçoit réellement — le canal de distribution en service.
 *
 * npm n'est pas obligatoire : `npx` accepte aussi bien un nom de paquet qu'une
 * URL de tarball. Tant que le paquet n'est pas publié, on peut donc servir
 * l'archive depuis le site lui-même (`npm run mcp:pack` la dépose dans
 * `public/mcp/`) et pointer les commandes dessus :
 *
 *     NEXT_PUBLIC_MCP_SOURCE=https://gotheref.com/mcp/got-the-ref-mcp.tgz
 *
 * La variable est publique par nature — c'est une adresse de téléchargement,
 * elle figure en clair dans les commandes affichées au client. Une fois le
 * paquet sur npm, on la retire et le nom court reprend la main : c'est lui qui
 * tient la commande d'installation sur une seule ligne lisible.
 */
export const MCP_INSTALL_SOURCE = process.env.NEXT_PUBLIC_MCP_SOURCE ?? MCP_PACKAGE;

/** Le nom sous lequel le serveur apparaît dans la configuration de l'agent. */
export const MCP_SERVER_NAME = "got_the_ref";

/** L'agent d'exécution activé une fois la connexion faite. */
export const MCP_AGENT_NAME = "got_the_ref";

/** Ce que l'agent lance pour parler au serveur, en une seule ligne. */
export const MCP_COMMAND = `npx -y ${MCP_INSTALL_SOURCE}`;

/** Le bloc de configuration MCP, pour les agents qui se règlent par fichier. */
export const MCP_JSON_SNIPPET = `{
  "mcpServers": {
    "${MCP_SERVER_NAME}": {
      "command": "npx",
      "args": ["-y", "${MCP_INSTALL_SOURCE}"]
    }
  }
}`;

/**
 * Base64 sans dépendance : `btoa` dans le navigateur, `Buffer` au rendu
 * serveur. La chaîne encodée n'est faite que d'ASCII, les deux voies donnent
 * donc le même résultat.
 */
function toBase64(value: string): string {
  return typeof btoa === "function"
    ? btoa(value)
    : Buffer.from(value, "utf8").toString("base64");
}

/**
 * Le lien d'installation en un clic de Cursor : l'éditeur reçoit le nom du
 * serveur et sa configuration encodée, puis demande confirmation au client.
 * Cursor n'a pas d'équivalent à `claude mcp add` en ligne de commande — ce lien
 * est la forme la plus courte qu'il accepte.
 */
export const MCP_CURSOR_LINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_SERVER_NAME}&config=${encodeURIComponent(
  toBase64(JSON.stringify({ command: "npx", args: ["-y", MCP_INSTALL_SOURCE] })),
)}`;

export type McpAgentId = "claude" | "codex" | "cursor" | "hermes";

export type McpAgentSetup = {
  id: McpAgentId;
  name: string;
  /**
   * `cli` : une commande à taper. `link` : une adresse à ouvrir. `json` : un
   * bloc à coller dans un fichier.
   */
  kind: "cli" | "link" | "json";
  /** La commande, le lien ou le bloc, tel qu'on le copie. */
  snippet: string;
  /** Où le poser — nom du fichier pour les agents qui se règlent à la main. */
  where: string;
  /** Le repli manuel, quand l'agent propose mieux qu'un fichier à éditer. */
  fallback?: { snippet: string; where: string };
};

/**
 * Les quatre agents pris en charge.
 *
 * Claude Code et Codex enregistrent un serveur MCP par une commande, et c'est
 * la forme la plus courte : un nom, la commande à lancer. Cursor n'a pas cette
 * sous-commande mais accepte un lien d'installation, avec le fichier de
 * configuration en repli. Hermes se règle par fichier. On donne à chacun sa
 * forme réelle plutôt qu'un tronc commun approximatif : une commande qui
 * échoue coûte plus cher qu'un onglet de plus.
 */
export const MCP_AGENTS: readonly McpAgentSetup[] = [
  {
    id: "claude",
    name: "Claude Code",
    kind: "cli",
    snippet: `claude mcp add ${MCP_SERVER_NAME} -- ${MCP_COMMAND}`,
    where: "Dans votre terminal",
  },
  {
    id: "codex",
    name: "Codex",
    kind: "cli",
    snippet: `codex mcp add ${MCP_SERVER_NAME} -- ${MCP_COMMAND}`,
    where: "Dans votre terminal",
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: "link",
    snippet: MCP_CURSOR_LINK,
    where: "Ouvre Cursor et demande confirmation",
    fallback: { snippet: MCP_JSON_SNIPPET, where: "~/.cursor/mcp.json" },
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
