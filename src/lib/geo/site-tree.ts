import type { GeoAnalysisResult } from "./types";
import { buildStructureFiles, type StructureFileKind } from "./structure-files";

/**
 * Le squelette du site, tel qu'un moteur de réponse le rencontre.
 *
 * Un moteur qui découvre un site ne lit pas un tableau de contrôles : il
 * demande une poignée d'adresses connues à la racine, puis regarde ce que la
 * page d'accueil déclare d'elle-même. Cette arborescence rejoue ce parcours
 * dans l'ordre où il a lieu — `/llms.txt`, `/robots.txt`, `/sitemap.xml`, puis
 * l'accueil et les quatre déclarations qu'elle porte.
 *
 * L'intérêt de la forme est de montrer les trous à leur place. Une grille de
 * contrôles dit « données structurées : absentes » ; l'arbre montre une ligne
 * vide sous la page d'accueil, à l'endroit exact où le fichier devrait être, et
 * le client comprend sans qu'on le lui explique où le correctif se pose.
 *
 * On n'y écrit que ce que l'audit a réellement relevé. Les adresses qu'un
 * gabarit ajouterait volontiers — un favicon, un `/.well-known/` — n'y sont pas :
 * le crawl ne les mesure pas, et une ligne verte non mesurée est un mensonge de
 * plus dans un écran vendu pour dire la vérité.
 */

export type SiteNodeStatus = "root" | "ok" | "warn" | "missing";

export type SiteNode = {
  /** Clé stable, pour le rendu et l'ancrage du contenu proposé. */
  key: string;
  /** Profondeur d'affichage : 0 la racine, 1 la racine du site, 2 l'accueil. */
  depth: number;
  /** Nom du fichier ou de la déclaration, tel qu'on l'écrit dans une URL. */
  name: string;
  /** Étiquette courte posée dans la pastille : « MD », « XML », « H1 ». */
  glyph: string;
  status: SiteNodeStatus;
  /** Ce que l'audit a trouvé là, en quelques mots. Vide si rien à dire. */
  note: string;
  /** Le contenu que la plateforme déposerait, quand elle sait l'écrire. */
  fix?: { kind: StructureFileKind; content: string };
  /**
   * La ligne est sous voile : son nom et son relevé ont été retirés avant le
   * rendu, et l'écran la floute (cf. `veilSiteTree`).
   */
  veiled?: boolean;
};

export type SiteTree = {
  nodes: SiteNode[];
  missingCount: number;
  warnCount: number;
  okCount: number;
  /** Y a-t-il quelque chose à déposer ? Sinon le pied de carte se tait. */
  hasFixes: boolean;
};

/** Coupe une valeur relevée à une longueur lisible sur une ligne. */
function short(value: string | null | undefined, max = 64): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function buildSiteTree(result: GeoAnalysisResult): SiteTree {
  const { signals } = result;
  const fixes = new Map(buildStructureFiles(result).map((file) => [file.kind, file]));
  const fixFor = (kind: StructureFileKind) => {
    const file = fixes.get(kind);
    return file ? { kind, content: file.content } : undefined;
  };

  const blocked = signals.crawlers.filter((crawler) => !crawler.allowed);
  const h1Count = signals.h1.length;

  const nodes: SiteNode[] = [
    {
      key: "root",
      depth: 0,
      name: signals.domain,
      glyph: "",
      status: "root",
      note: "racine du site",
    },
    {
      key: "llmsTxt",
      depth: 1,
      name: "llms.txt",
      glyph: "MD",
      // Un fichier servi en 404 est absent pour un modèle : il ne le lit pas.
      status: signals.hasLlmsTxt ? "ok" : "missing",
      note: signals.hasLlmsTxt
        ? "servi en 200"
        : signals.llmsTxtMisconfigured
          ? "présent mais renvoyé en erreur"
          : "aucun fichier servi",
      fix: fixFor("llmsTxt"),
    },
    {
      key: "robotsTxt",
      depth: 1,
      name: "robots.txt",
      glyph: "TXT",
      status: !signals.hasRobotsTxt ? "missing" : blocked.length ? "warn" : "ok",
      note: !signals.hasRobotsTxt
        ? "aucun fichier servi"
        : blocked.length
          ? `${blocked.map((crawler) => crawler.name).join(", ")} bloqué${blocked.length > 1 ? "s" : ""}`
          : "tous les robots d'IA passent",
      fix: fixFor("robotsTxt"),
    },
    {
      key: "sitemap",
      depth: 1,
      name: "sitemap.xml",
      glyph: "XML",
      status: signals.hasSitemap ? "ok" : "missing",
      note: signals.hasSitemap ? "servi en 200" : "aucun fichier servi",
    },
    {
      key: "home",
      depth: 1,
      name: "/",
      glyph: "HTM",
      status: signals.fetchedOk ? "ok" : "warn",
      note: signals.fetchedOk
        ? "page d'accueil"
        : `page d'accueil illisible${signals.statusCode ? ` (${signals.statusCode})` : ""}`,
    },
    {
      key: "title",
      depth: 2,
      name: "title",
      glyph: "T",
      status: signals.title ? "ok" : "missing",
      note: short(signals.title) || "aucune balise title",
    },
    {
      key: "metaDescription",
      depth: 2,
      name: "meta description",
      glyph: "M",
      status: signals.metaDescription ? "ok" : "missing",
      note: signals.metaDescription
        ? `${signals.metaDescription.trim().length} caractères`
        : "aucune méta description",
    },
    {
      key: "h1",
      depth: 2,
      name: "h1",
      glyph: "H1",
      // Deux H1 valent mieux que zéro mais brouillent le sujet de la page.
      status: h1Count === 1 ? "ok" : h1Count === 0 ? "missing" : "warn",
      note: h1Count === 0 ? "aucun H1" : h1Count === 1 ? short(signals.h1[0]) : `${h1Count} H1 détectés`,
    },
    {
      key: "jsonLd",
      depth: 2,
      name: "ld+json",
      glyph: "{ }",
      status: signals.jsonLdCount > 0 ? "ok" : "missing",
      note: signals.jsonLdCount
        ? signals.jsonLdTypes.length
          ? signals.jsonLdTypes.join(", ")
          : `${signals.jsonLdCount} bloc${signals.jsonLdCount > 1 ? "s" : ""}`
        : "aucune donnée structurée",
      fix: fixFor("jsonLd"),
    },
  ];

  const count = (status: SiteNodeStatus) =>
    nodes.filter((node) => node.status === status).length;

  return {
    nodes,
    missingCount: count("missing"),
    warnCount: count("warn"),
    okCount: count("ok"),
    hasFixes: fixes.size > 0,
  };
}

/**
 * Le même squelette, mais sans dire lesquelles des lignes manquent.
 *
 * C'est la forme rendue à un compte gratuit. L'arbre reste entier — la racine,
 * les sept adresses, l'indentation, les compteurs en tête —, et seules les
 * lignes qui portent un correctif perdent leur nom, leur relevé et le contenu
 * du fichier. Le client voit donc qu'il manque trois choses à sa racine, et à
 * quelle profondeur elles se posent, sans apprendre lesquelles.
 *
 * Le masquage est fait ici, au serveur, et pas au CSS. Un flou se retire en
 * deux clics dans un inspecteur ; un nom de fichier jamais rendu ne se retire
 * pas. Ce qui part vers le navigateur d'un compte gratuit ne contient ni le nom
 * du fichier absent, ni une ligne de son contenu.
 *
 * Les lignes en place restent nettes : elles ne se vendent pas, elles se
 * constatent, et ce sont elles qui rendent l'arbre lisible.
 */
export function veilSiteTree(tree: SiteTree): SiteTree {
  return {
    ...tree,
    nodes: tree.nodes.map((node) => {
      if (node.status !== "missing" && node.status !== "warn") return node;
      return {
        key: node.key,
        depth: node.depth,
        // Une longueur plausible, jamais la vraie : « llms.txt » et
        // « meta description » ne font pas la même largeur, et la largeur seule
        // suffirait à deviner la ligne.
        name: "••••••••••",
        glyph: "•••",
        status: node.status,
        note: "",
        veiled: true,
      };
    }),
  };
}
