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
  },
  {
    id: "shopify",
    name: "Shopify",
    docsUrl: "https://shopify.dev/docs/api/admin-rest",
    capabilities: ["publish", "edit"],
    fields: [
      { name: "shopDomain", kind: "text", required: true },
      { name: "adminAccessToken", kind: "secret", required: true },
    ],
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
