import type { PlatformId } from "./platforms";

/**
 * Les plateformes auxquelles on sait se rattacher, et ce qu'il faut demander au
 * client pour chacune.
 *
 * Le tableau décrit la porte d'entrée, pas l'implémentation : chaque plateforme
 * expose une API différente, mais toutes se ramènent à une poignée de champs et
 * à deux droits — déposer un article, réécrire une page. Le formulaire de
 * connexion se construit à partir d'ici, sans un composant par plateforme.
 *
 * Un champ `secret` n'est jamais renvoyé au navigateur une fois enregistré : on
 * affiche l'état du lien, pas le jeton.
 */

/** Ce qu'un lien autorise. Toutes les plateformes ne donnent pas les deux. */
export type SiteCapability = "publish" | "edit";

export type ConnectorField = {
  name: string;
  /** Type d'entrée du formulaire ; `secret` masque la saisie. */
  kind: "text" | "url" | "secret";
  required: boolean;
};

export type SiteConnector = {
  id: PlatformId | "custom";
  name: string;
  /** Chemin de la doc côté plateforme, pour la ligne d'aide du formulaire. */
  docsUrl: string | null;
  capabilities: SiteCapability[];
  fields: ConnectorField[];
  /**
   * Ouvert aux clients, ou seulement écrit.
   *
   * Le code sait appeler la plupart de ces plateformes, mais seules WordPress
   * et Shopify ont été menées jusqu'au bout — identifiants vérifiés sur de
   * vrais sites, article publié, page corrigée, manuel écrit. Les autres se
   * montrent grisées : promettre un rattachement qu'on n'a pas éprouvé coûte
   * plus cher que de dire « bientôt ».
   *
   * Le drapeau n'est pas décoratif : `connectSiteAction` refuse un connecteur
   * fermé. Une case grisée se déjoue avec l'inspecteur, pas un refus serveur.
   */
  ready: boolean;
};

export const SITE_CONNECTORS: SiteConnector[] = [
  {
    id: "wordpress",
    name: "WordPress",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    capabilities: ["publish", "edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "username", kind: "text", required: true },
      { name: "applicationPassword", kind: "secret", required: true },
    ],
    ready: true,
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
    capabilities: ["publish", "edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "username", kind: "text", required: true },
      { name: "applicationPassword", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "shopify",
    name: "Shopify",
    docsUrl: "https://shopify.dev/docs/api/admin-rest",
    capabilities: ["publish", "edit"],
    fields: [
      { name: "shopDomain", kind: "text", required: true },
      { name: "adminAccessToken", kind: "secret", required: true },
      // Une boutique a souvent plusieurs blogs, et le premier n'est pas
      // toujours celui que le client tient à jour. Laissé vide, on écrit dans
      // le premier — ce qui reste le cas courant, avec le seul « News ».
      { name: "blogHandle", kind: "text", required: false },
    ],
    ready: true,
  },
  {
    id: "wix",
    name: "Wix",
    docsUrl: "https://dev.wix.com/docs/rest",
    // Le blog Wix se lit par l'API, mais y déposer un article demande un flux
    // de publication à part : pour l'instant, le lien sert aux corrections.
    capabilities: ["edit"],
    fields: [
      { name: "siteId", kind: "text", required: true },
      { name: "apiKey", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "webflow",
    name: "Webflow",
    docsUrl: "https://developers.webflow.com/data/reference",
    // Publier chez Webflow suppose de choisir une collection CMS et d'en
    // connaître les champs : tant que ce choix n'est pas demandé, corrections
    // seulement.
    capabilities: ["edit"],
    fields: [
      { name: "siteId", kind: "text", required: true },
      { name: "apiToken", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "squarespace",
    name: "Squarespace",
    docsUrl: "https://developers.squarespace.com/",
    // L'API Squarespace couvre le commerce, pas la rédaction : le lien sert aux
    // corrections, l'article se dépose depuis son éditeur.
    capabilities: ["edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "apiKey", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "ghost",
    name: "Ghost",
    docsUrl: "https://ghost.org/docs/admin-api/",
    capabilities: ["publish", "edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "adminApiKey", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    docsUrl: "https://devdocs.prestashop-project.org/webservice/",
    // Le webservice PrestaShop expose le catalogue, pas le blog.
    capabilities: ["edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "webserviceKey", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "framer",
    name: "Framer",
    docsUrl: "https://www.framer.com/developers/",
    // Framer publie depuis son propre éditeur : rien à appeler de l'extérieur.
    capabilities: ["edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "apiToken", kind: "secret", required: true },
    ],
    ready: false,
  },
  {
    id: "custom",
    name: "Autre site",
    docsUrl: null,
    // Un site fait main n'expose rien de standard. On garde le dépôt Git ou le
    // webhook que le client nous donne, et l'agent y pousse ses corrections.
    capabilities: ["publish", "edit"],
    fields: [
      { name: "siteUrl", kind: "url", required: true },
      { name: "webhookUrl", kind: "url", required: false },
      { name: "apiToken", kind: "secret", required: false },
    ],
    ready: false,
  },
];

export const connectorFor = (id: string): SiteConnector | undefined =>
  SITE_CONNECTORS.find((connector) => connector.id === id);

/**
 * Le connecteur à proposer d'emblée, d'après la plateforme reconnue au crawl.
 * Un site sur mesure (Next.js, Notion…) retombe sur « custom » : rien à
 * deviner de son API, mais on peut quand même lui pousser des corrections.
 */
export const connectorForStack = (stackId: string | null | undefined): SiteConnector => {
  const match = stackId ? connectorFor(stackId) : undefined;
  return match ?? (connectorFor("custom") as SiteConnector);
};
