import "server-only";

import * as cheerio from "cheerio";
import type { StructureFileKind } from "@/lib/geo/structure-files";
import { appPassword, call, shopifyGraphql, wpSite, type Credentials } from "./connectors";

/**
 * Ce que les agents écrivent sur le site du client, une fois le lien établi :
 * les textes on-page et les fichiers que les IA cherchent à la racine.
 *
 * Le principe est le même partout : on tente, on relit, et on dit la vérité.
 * Une plateforme qui accepte un appel sans rien enregistrer est le cas courant
 * — WordPress ignore en silence une clé de métadonnée non déclarée, Shopify
 * accepte un métachamp que le thème n'affichera jamais. Chaque étape est donc
 * relue après écriture, et ce qui n'a pas pris ressort en « à faire à la main »
 * avec le texte exact à coller, jamais en succès muet.
 *
 * Ce que chaque plateforme laisse réellement faire :
 *
 * - WordPress : tout, ou presque. La page d'accueil s'édite par l'API REST —
 *   H1 et premier paragraphe compris — et les métadonnées SEO passent par les
 *   clés de Yoast ou de Rank Math quand l'un des deux est installé. Les
 *   fichiers de racine (`/llms.txt`, `/robots.txt`) ne s'écrivent pas par REST :
 *   ils restent manuels, contenu fourni.
 * - Shopify : la boutique est fermée. Les articles de blog passent (voir
 *   `connectors`), les métachamps SEO aussi, mais la racine appartient à
 *   Shopify — `/sitemap.xml` et `/robots.txt` sont générés par la plateforme,
 *   et aucun fichier arbitraire ne peut y être déposé. Les sections du thème
 *   portent le H1 et le premier paragraphe, et leurs clés changent d'un thème à
 *   l'autre : on ne les touche pas au jugé.
 *
 * Le rattachement est ouvert aux clients depuis les réglages : ce qui suit part
 * donc vers de vrais sites, sur des hébergements que l'on ne choisit pas. D'où
 * les bornes de temps héritées de `connectors` — un mutualisé qui ne répond
 * jamais ne doit pas retenir l'écran du client, ni le passage de la nuit.
 */

export type SyncStatus =
  /** Écrit sur le site, et relu pour le vérifier. */
  | "applied"
  /** La plateforme ne le permet pas : le client (ou son agent) le fait. */
  | "manual"
  /** Tenté, refusé par la plateforme. */
  | "failed"
  /** Sans objet ici (rien à changer, ou déjà en place). */
  | "skipped";

export type SyncStep = {
  /** Identifiant stable de l'étape, pour l'affichage et les journaux. */
  key: string;
  status: SyncStatus;
  /** Ce qui s'est passé, en une phrase lisible par le client. */
  detail: string;
};

/** Les quatre textes de la page d'accueil que l'audit sait réécrire. */
export type OnPagePatch = {
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  firstParagraph?: string | null;
};

export type StructureFile = {
  kind: StructureFileKind;
  /** Chemin attendu par les moteurs : « /llms.txt », « /robots.txt ». */
  path: string;
  content: string;
};

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

/** La marque de nos propres insertions, pour ne jamais en poser deux. */
const MARKER = "got_the_ref";

async function shortError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return clean ? `${response.status} : ${clean}` : `Réponse ${response.status}.`;
}

const failure = (key: string, error: unknown): SyncStep => ({
  key,
  status: "failed",
  detail: error instanceof Error ? error.message : String(error),
});

// ── WordPress ────────────────────────────────────────────────────────────────

type WpSettings = {
  title?: string;
  description?: string;
  show_on_front?: string;
  page_on_front?: number;
};

type WpPage = {
  id: number;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  meta?: Record<string, unknown>;
};

/**
 * Les clés de métadonnées des deux extensions SEO qui couvrent l'essentiel du
 * parc. On écrit les quatre : celle qui n'existe pas est ignorée par
 * WordPress, et la relecture dira laquelle a pris.
 */
const SEO_TITLE_KEYS = ["_yoast_wpseo_title", "rank_math_title"] as const;
const SEO_DESCRIPTION_KEYS = ["_yoast_wpseo_metadesc", "rank_math_description"] as const;

function wpHeaders(credentials: Credentials) {
  return {
    Authorization: basic(credentials.username.trim(), appPassword(credentials.applicationPassword)),
    "Content-Type": "application/json",
  };
}

async function wpJson<T>(
  site: string,
  credentials: Credentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  // Même borne de temps qu'à la connexion : ces écritures partent depuis une
  // action du client, qui attend devant son écran.
  const response = await call(`${site}${path}`, {
    ...init,
    headers: wpHeaders(credentials),
  });
  if (!response.ok) throw new Error(await shortError(response));
  return (await response.json()) as T;
}

/**
 * La page qui sert d'accueil, quand il y en a une.
 *
 * Un WordPress réglé sur « derniers articles » n'a pas de page d'accueil à
 * éditer : son H1 est le titre du site et sa liste est générée. On le dit
 * plutôt que de réécrire une page au hasard.
 */
async function wpFrontPage(site: string, credentials: Credentials): Promise<WpPage | null> {
  const settings = await wpJson<WpSettings>(site, credentials, "/wp-json/wp/v2/settings");
  if (settings.show_on_front !== "page" || !settings.page_on_front) return null;
  return wpJson<WpPage>(
    site,
    credentials,
    `/wp-json/wp/v2/pages/${settings.page_on_front}?context=edit`,
  );
}

/**
 * Réécrit le premier H1 et le premier paragraphe d'un contenu, sans toucher au
 * reste.
 *
 * Le contenu est chargé en fragment (`false` en troisième argument) : ni
 * `<html>` ni `<body>` ne sont ajoutés, et les commentaires de blocs Gutenberg
 * — `<!-- wp:heading -->` — traversent intacts. Seul le texte des deux
 * éléments visés change ; classes, attributs et blocs voisins sont rendus tels
 * qu'ils sont arrivés.
 */
function patchHtml(html: string, patch: OnPagePatch): { html: string; changed: string[] } {
  const $ = cheerio.load(html, null, false);
  const changed: string[] = [];

  if (patch.h1) {
    const h1 = $("h1").first();
    if (h1.length && h1.text().trim() !== patch.h1) {
      h1.text(patch.h1);
      changed.push("h1");
    }
  }

  if (patch.firstParagraph) {
    const paragraph = $("p").first();
    if (paragraph.length && paragraph.text().trim() !== patch.firstParagraph) {
      paragraph.text(patch.firstParagraph);
      changed.push("firstParagraph");
    }
  }

  return { html: $.html(), changed };
}

async function wordpressOnPage(
  credentials: Credentials,
  patch: OnPagePatch,
): Promise<SyncStep[]> {
  const site = wpSite(credentials.siteUrl ?? "");
  const steps: SyncStep[] = [];

  let page: WpPage | null;
  try {
    page = await wpFrontPage(site, credentials);
  } catch (error) {
    return [failure("frontPage", error)];
  }

  if (!page) {
    return [
      {
        key: "frontPage",
        status: "manual",
        detail:
          "Ce WordPress affiche les derniers articles en page d'accueil : il n'y a pas de page à réécrire. Choisissez une page d'accueil statique (Réglages → Lecture) pour que les corrections s'appliquent toutes seules.",
      },
    ];
  }

  // 1. Titre et méta description : par les clés de l'extension SEO installée.
  const meta: Record<string, string> = {};
  if (patch.title) for (const key of SEO_TITLE_KEYS) meta[key] = patch.title;
  if (patch.metaDescription) {
    for (const key of SEO_DESCRIPTION_KEYS) meta[key] = patch.metaDescription;
  }

  if (Object.keys(meta).length > 0) {
    try {
      const saved = await wpJson<WpPage>(
        site,
        credentials,
        `/wp-json/wp/v2/pages/${page.id}?context=edit`,
        { method: "POST", body: JSON.stringify({ meta }) },
      );

      // WordPress ignore en silence une clé de métadonnée non déclarée : seule
      // la relecture dit si l'extension SEO a bien reçu le texte.
      const stored = (saved.meta ?? {}) as Record<string, unknown>;
      const titleTaken = SEO_TITLE_KEYS.some((key) => stored[key] === patch.title);
      const descriptionTaken = SEO_DESCRIPTION_KEYS.some(
        (key) => stored[key] === patch.metaDescription,
      );

      if (patch.title) {
        steps.push(
          titleTaken
            ? { key: "title", status: "applied", detail: `Balise title posée : « ${patch.title} »` }
            : {
                key: "title",
                status: "manual",
                detail: `Aucune extension SEO n'a accepté la balise title. À coller dans Yoast ou Rank Math : « ${patch.title} »`,
              },
        );
      }
      if (patch.metaDescription) {
        steps.push(
          descriptionTaken
            ? {
                key: "metaDescription",
                status: "applied",
                detail: `Méta description posée : « ${patch.metaDescription} »`,
              }
            : {
                key: "metaDescription",
                status: "manual",
                detail: `Aucune extension SEO n'a accepté la méta description. À coller dans Yoast ou Rank Math : « ${patch.metaDescription} »`,
              },
        );
      }
    } catch (error) {
      steps.push(failure("seoMeta", error));
    }
  }

  // 2. H1 et premier paragraphe : dans le contenu de la page elle-même.
  const raw = page.content?.raw ?? "";
  if (raw && (patch.h1 || patch.firstParagraph)) {
    const { html, changed } = patchHtml(raw, patch);
    if (changed.length === 0) {
      steps.push({
        key: "content",
        status: "skipped",
        detail: "Le H1 et le premier paragraphe de la page d'accueil sont déjà ceux proposés.",
      });
    } else {
      try {
        await wpJson<WpPage>(site, credentials, `/wp-json/wp/v2/pages/${page.id}`, {
          method: "POST",
          body: JSON.stringify({ content: html }),
        });
        for (const key of changed) {
          steps.push({
            key,
            status: "applied",
            detail:
              key === "h1"
                ? `H1 de la page d'accueil réécrit : « ${patch.h1} »`
                : "Premier paragraphe de la page d'accueil réécrit.",
          });
        }
      } catch (error) {
        steps.push(failure("content", error));
      }
    }
  }

  return steps;
}

/**
 * Les fichiers de racine, côté WordPress.
 *
 * `/llms.txt` et `/robots.txt` ne s'écrivent pas par l'API REST : le premier
 * n'existe pas dans WordPress, le second est servi virtuellement par le cœur.
 * Les déposer demande un accès aux fichiers (FTP, SFTP, gestionnaire de
 * l'hébergeur) ou une extension. On rend donc le contenu exact, prêt à coller,
 * plutôt que de faire croire à une écriture.
 *
 * Le JSON-LD, lui, part dans le contenu de la page d'accueil — quand le compte
 * a le droit d'y poser une balise `script`, ce que la relecture vérifie.
 */
async function wordpressStructure(
  credentials: Credentials,
  files: StructureFile[],
): Promise<SyncStep[]> {
  const site = wpSite(credentials.siteUrl ?? "");
  const steps: SyncStep[] = [];

  for (const file of files.filter((item) => item.kind !== "jsonLd")) {
    steps.push({
      key: file.kind,
      status: "manual",
      detail: `WordPress ne permet pas d'écrire ${file.path} par son API. Déposez le fichier à la racine du site (FTP ou gestionnaire de fichiers de votre hébergeur) avec le contenu fourni.`,
    });
  }

  const jsonLd = files.find((file) => file.kind === "jsonLd");
  if (!jsonLd) return steps;

  try {
    const page = await wpFrontPage(site, credentials);
    if (!page) {
      steps.push({
        key: "jsonLd",
        status: "manual",
        detail:
          "Pas de page d'accueil statique où poser les données structurées : collez le script dans l'en-tête du thème.",
      });
      return steps;
    }

    const raw = page.content?.raw ?? "";
    if (raw.includes(MARKER)) {
      steps.push({
        key: "jsonLd",
        status: "skipped",
        detail: "Les données structurées sont déjà en place sur la page d'accueil.",
      });
      return steps;
    }

    const block = `\n<!-- ${MARKER}:jsonld -->\n<script type="application/ld+json">${jsonLd.content}</script>\n`;
    const saved = await wpJson<WpPage>(site, credentials, `/wp-json/wp/v2/pages/${page.id}`, {
      method: "POST",
      body: JSON.stringify({ content: `${raw}${block}` }),
    });

    // WordPress retire les balises `script` du contenu quand le compte n'a pas
    // le droit `unfiltered_html` : sans cette relecture, on annoncerait un
    // balisage que le site n'a jamais servi.
    const stored = saved.content?.raw ?? "";
    steps.push(
      stored.includes("application/ld+json")
        ? {
            key: "jsonLd",
            status: "applied",
            detail: "Données structurées JSON-LD ajoutées à la page d'accueil.",
          }
        : {
            key: "jsonLd",
            status: "manual",
            detail:
              "WordPress a retiré le script des données structurées (droit unfiltered_html manquant). Passez par votre extension SEO ou l'en-tête du thème.",
          },
    );
  } catch (error) {
    steps.push(failure("jsonLd", error));
  }

  return steps;
}

// ── Shopify ──────────────────────────────────────────────────────────────────

const SHOP_ID = `query { shop { id } }`;

const METAFIELDS_SET = `
mutation Seo($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key namespace value }
    userErrors { field message }
  }
}`;

/**
 * Le SEO de la boutique, posé sur les métachamps standard.
 *
 * `global.title_tag` et `global.description_tag` sont les clés que les thèmes
 * Shopify lisent pour la balise title et la méta description. Les écrire ne
 * garantit pas que le thème du client les affiche — d'où le rappel manuel qui
 * accompagne l'étape : la page d'accueil garde aussi ses champs dans Boutique
 * en ligne → Préférences, hors API.
 */
async function shopifyOnPage(credentials: Credentials, patch: OnPagePatch): Promise<SyncStep[]> {
  const steps: SyncStep[] = [];

  const metafields: { key: string; value: string }[] = [];
  if (patch.title) metafields.push({ key: "title_tag", value: patch.title });
  if (patch.metaDescription) {
    metafields.push({ key: "description_tag", value: patch.metaDescription });
  }

  if (metafields.length > 0) {
    try {
      const { shop } = await shopifyGraphql<{ shop: { id: string } }>(credentials, SHOP_ID, {});
      const result = await shopifyGraphql<{
        metafieldsSet: {
          metafields: { key: string; value: string }[];
          userErrors: { message?: string }[];
        };
      }>(credentials, METAFIELDS_SET, {
        metafields: metafields.map((metafield) => ({
          ownerId: shop.id,
          namespace: "global",
          type: "single_line_text_field",
          ...metafield,
        })),
      });

      const errors = result.metafieldsSet.userErrors;
      if (errors.length > 0) {
        steps.push({
          key: "seoMetafields",
          status: "failed",
          detail: errors.map((error) => error.message ?? "refusé").join(" · "),
        });
      } else {
        const written = result.metafieldsSet.metafields.map((metafield) => metafield.key);
        steps.push({
          key: "seoMetafields",
          status: written.length ? "applied" : "failed",
          detail: written.length
            ? `Métachamps SEO posés sur la boutique : ${written.join(", ")}.`
            : "Shopify n'a enregistré aucun métachamp.",
        });
      }
    } catch (error) {
      steps.push(failure("seoMetafields", error));
    }
  }

  if (patch.title || patch.metaDescription) {
    steps.push({
      key: "homepagePreferences",
      status: "manual",
      detail: [
        "La balise title et la méta description de la page d'accueil restent hors API chez Shopify.",
        "À recopier dans Boutique en ligne → Préférences :",
        patch.title ? `titre « ${patch.title} »` : null,
        patch.metaDescription ? `description « ${patch.metaDescription} »` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (patch.h1 || patch.firstParagraph) {
    steps.push({
      key: "content",
      status: "manual",
      detail: [
        "Le H1 et le premier paragraphe vivent dans les sections du thème, dont les réglages changent d'un thème à l'autre : les modifier au jugé casserait la page.",
        "À coller dans l'éditeur de thème :",
        patch.h1 ? `H1 « ${patch.h1} »` : null,
        patch.firstParagraph ? `paragraphe « ${patch.firstParagraph} »` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  return steps;
}

/**
 * Les fichiers de racine, côté Shopify : la plateforme les tient.
 *
 * `/sitemap.xml` est généré et tenu à jour par Shopify. `/robots.txt` l'est
 * aussi, et ne se personnalise que par le gabarit `robots.txt.liquid` du thème.
 * Un fichier arbitraire à la racine — `/llms.txt` — n'est pas possible : le
 * domaine est servi par Shopify, pas par le client.
 */
async function shopifyStructure(files: StructureFile[]): Promise<SyncStep[]> {
  return files.map((file) => {
    if (file.kind === "robotsTxt") {
      return {
        key: file.kind,
        status: "manual" as const,
        detail:
          "Shopify génère /robots.txt. Pour l'amender : Boutique en ligne → Thèmes → Modifier le code → ajouter le gabarit robots.txt.liquid, puis y reporter les règles fournies.",
      };
    }
    if (file.kind === "llmsTxt") {
      return {
        key: file.kind,
        status: "manual" as const,
        detail:
          "Shopify n'autorise aucun fichier à la racine du domaine : /llms.txt ne peut pas y être déposé. Le contenu reste utile si vous passez un jour par un domaine que vous servez vous-même.",
      };
    }
    return {
      key: file.kind,
      status: "manual" as const,
      detail:
        "Les données structurées se posent dans le thème : Boutique en ligne → Thèmes → Modifier le code, dans layout/theme.liquid avant </head>.",
    };
  });
}

// ── Entrées publiques ────────────────────────────────────────────────────────

const UNSUPPORTED: SyncStep[] = [
  {
    key: "platform",
    status: "manual",
    detail:
      "Cette plateforme n'ouvre pas ses pages à une API tierce : les corrections se collent depuis son éditeur, avec le prompt fourni.",
  },
];

export async function applyOnPage(
  platform: string,
  credentials: Credentials,
  patch: OnPagePatch,
): Promise<SyncStep[]> {
  switch (platform) {
    case "wordpress":
    case "woocommerce":
      return wordpressOnPage(credentials, patch);
    case "shopify":
      return shopifyOnPage(credentials, patch);
    default:
      return UNSUPPORTED;
  }
}

export async function applyStructure(
  platform: string,
  credentials: Credentials,
  files: StructureFile[],
): Promise<SyncStep[]> {
  if (files.length === 0) return [];

  switch (platform) {
    case "wordpress":
    case "woocommerce":
      return wordpressStructure(credentials, files);
    case "shopify":
      return shopifyStructure(files);
    default:
      return UNSUPPORTED;
  }
}
