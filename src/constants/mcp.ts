import { SITE } from "./site";

/**
 * Le serveur MCP got_the_ref, et comment on le branche à chaque agent.
 *
 * MCP (Model Context Protocol) est la prise standard entre un agent IA et un
 * service. En la branchant, l'agent du client — Claude Code, Codex, Cursor,
 * Hermes — cesse d'attendre qu'on lui colle un prompt : il relève lui-même le
 * statut du compte et les correctifs, puis les applique.
 *
 * La prise n'est plus un programme à installer sur le poste du client : elle
 * est servie par le site, à l'adresse `/mcp/<clé>`. L'agent s'y connecte en
 * HTTP. Conséquences, et elles comptent toutes les trois :
 *
 *   — rien à télécharger, rien à publier sur un registre, rien à tenir à jour
 *     poste par poste ;
 *   — le code du serveur suit le déploiement du site, donc la charte et les
 *     correctifs ne peuvent pas diverger d'une version installée ailleurs ;
 *   — la commande d'installation tient sur une ligne, et c'est la même dans
 *     les quatre agents à la syntaxe près.
 *
 * La clé voyage dans l'adresse. C'est ce qui permet à cette ligne unique de
 * marcher partout : Cursor et les configurations par fichier n'acceptent
 * qu'une URL, pas un en-tête. Une adresse est donc ici un secret — elle se
 * traite comme un mot de passe, et se coupe depuis le tableau de bord.
 *
 * Ce fichier ne contient que des données : il est lu par la modale de
 * rattachement comme par la page de connexion.
 */

/** Le nom sous lequel le serveur apparaît dans la configuration de l'agent. */
export const MCP_SERVER_NAME = "got_the_ref";

/** L'agent d'exécution activé une fois la prise branchée. */
export const MCP_AGENT_NAME = "got_the_ref";

/** L'adresse de la prise pour une clé donnée. */
export function mcpEndpoint(key: string): string {
  return `${SITE.url.replace(/\/+$/, "")}/mcp/${key}`;
}

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

/** Le bloc de configuration MCP, pour les agents qui se règlent par fichier. */
export function mcpJsonSnippet(endpoint: string): string {
  return `{
  "mcpServers": {
    "${MCP_SERVER_NAME}": {
      "url": "${endpoint}"
    }
  }
}`;
}

/**
 * Le lien d'installation en un clic de Cursor : l'éditeur reçoit le nom du
 * serveur et sa configuration encodée, puis demande confirmation au client.
 * Cursor n'a pas d'équivalent à `claude mcp add` en ligne de commande — ce lien
 * est la forme la plus courte qu'il accepte.
 */
export function mcpCursorLink(endpoint: string): string {
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_SERVER_NAME}&config=${encodeURIComponent(
    toBase64(JSON.stringify({ url: endpoint })),
  )}`;
}

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

/** Les quatre agents pris en charge, dans l'ordre des onglets. */
export const MCP_AGENT_NAMES: Record<McpAgentId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  hermes: "Hermes",
};

export const MCP_AGENT_IDS = ["claude", "codex", "cursor", "hermes"] as const;

/**
 * La forme d'installation de chaque agent, pour une adresse donnée.
 *
 * Claude Code et Codex enregistrent un serveur distant par une commande, et
 * c'est la forme la plus courte : un nom, une adresse. Claude reçoit
 * `--scope user` — la prise vaut pour tous les projets du client, pas
 * seulement pour le dossier d'où la commande est lancée. Cursor n'a pas de
 * sous-commande `mcp add` mais accepte un lien d'installation, avec le fichier
 * de configuration en repli. Hermes se règle par fichier.
 *
 * On donne à chacun sa forme réelle plutôt qu'un tronc commun approximatif :
 * une commande qui échoue coûte plus cher qu'un onglet de plus.
 */
export function mcpAgentSetups(endpoint: string): McpAgentSetup[] {
  const json = mcpJsonSnippet(endpoint);

  return [
    {
      id: "claude",
      name: MCP_AGENT_NAMES.claude,
      kind: "cli",
      snippet: `claude mcp add --scope user --transport http ${MCP_SERVER_NAME} ${endpoint}`,
      where: "Dans votre terminal",
    },
    {
      id: "codex",
      name: MCP_AGENT_NAMES.codex,
      kind: "cli",
      snippet: `codex mcp add ${MCP_SERVER_NAME} --url ${endpoint}`,
      where: "Dans votre terminal",
    },
    {
      id: "cursor",
      name: MCP_AGENT_NAMES.cursor,
      kind: "link",
      snippet: mcpCursorLink(endpoint),
      where: "Ouvre Cursor et demande confirmation",
      fallback: { snippet: json, where: "~/.cursor/mcp.json" },
    },
    {
      id: "hermes",
      name: MCP_AGENT_NAMES.hermes,
      kind: "json",
      snippet: json,
      where: "Dans la configuration MCP de Hermes",
    },
  ];
}

/**
 * La phrase à dire à l'agent une fois la prise branchée.
 *
 * Il n'y a plus d'appairage à confirmer : l'adresse porte déjà la clé. La
 * première phrase envoie donc directement l'agent au travail.
 */
export const MCP_FIRST_PROMPT = `Applique mes correctifs ${MCP_SERVER_NAME}.`;

/**
 * Le nombre d'étapes de la connexion, dans l'ordre : créer la clé, brancher la
 * prise, laisser l'agent corriger. La modale en fait un rail.
 */
export const MCP_STEPS = ["creer", "brancher", "corriger"] as const;
export type McpStep = (typeof MCP_STEPS)[number];
