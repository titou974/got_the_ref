import "server-only";

import { SignJWT } from "jose";
import { AppError } from "@/lib/errors";
import { markdownToHtml } from "@/lib/markdown-html";
import type { SiteCapability } from "@/constants/site-platforms";

/**
 * Les appels sortants vers le site du client : vérifier le lien, puis publier.
 *
 * Chaque plateforme a sa porte, mais le reste de l'application ne voit que deux
 * fonctions. `verify` sert au moment de la connexion : un appel authentifié qui
 * ne renvoie rien d'utile n'est pas un lien, c'est une promesse. `publish` dépose
 * un article et rend son URL publique.
 *
 * Les plateformes qui n'ouvrent pas leur rédaction (Squarespace, PrestaShop,
 * Framer) sont rattachées quand même : le lien sert alors aux corrections
 * on-page, et l'interface n'annonce que ce que `capabilities` contient.
 */

export type Credentials = Record<string, string>;

export type VerifyResult = {
  ok: boolean;
  /** Ce que le lien permet réellement, une fois la plateforme interrogée. */
  capabilities: SiteCapability[];
  siteUrl: string | null;
  error?: string;
};

export type PublishInput = {
  title: string;
  /** Le corps de l'article, en Markdown — converti en HTML avant l'envoi. */
  body: string;
  excerpt?: string | null;
  slug?: string | null;
  /** La signature de l'article, là où la plateforme en exige une (Shopify). */
  author?: string | null;
};

export type PublishResult = { url: string | null; externalId: string | null };

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * Le délai au-delà duquel on abandonne un appel vers le site du client.
 *
 * Ces requêtes sortent vers des hébergements que l'on ne choisit pas : un
 * mutualisé qui rame, un pare-feu qui avale la demande sans jamais répondre.
 * Sans limite, `fetch` attend la coupure du socket — le formulaire de
 * rattachement reste figé, et la tâche planifiée brûle son budget sur un seul
 * site pendant que les autres attendent leur tour.
 */
const TIMEOUT_MS = 15_000;

/**
 * Un appel sortant borné dans le temps, et dont l'échec se lit.
 *
 * `AbortSignal.timeout` lève une `TimeoutError` dont le texte ne dit rien à un
 * commerçant. La traduction se fait ici, une fois, pour que tous les appels de
 * ce fichier échouent de la même manière.
 */
export async function call(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AppError(
        `Le site n'a pas répondu en ${TIMEOUT_MS / 1000} secondes.`,
        "SITE_TIMEOUT",
        504,
      );
    }
    throw new AppError(
      error instanceof Error ? error.message : "Site injoignable.",
      "SITE_UNREACHABLE",
      502,
    );
  }
}

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

/**
 * L'adresse d'un site WordPress, ramenée à sa racine.
 *
 * Le client colle ce qu'il a sous les yeux : la barre d'adresse de son
 * administration (`…/wp-admin/options-general.php`), parfois l'API elle-même,
 * souvent sans le schéma. Trois nettoyages valent mieux qu'un refus pour une
 * barre oblique de trop.
 */
export function wpSite(value: string): string {
  const raw = value.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return trimSlash(withScheme.replace(/\/(wp-admin|wp-login\.php|wp-json)(\/.*)?$/i, ""));
}

/**
 * Le mot de passe d'application tel que WordPress l'accepte.
 *
 * L'écran qui le crée l'affiche en six groupes séparés par des espaces, et
 * c'est ainsi qu'il est copié. WordPress les retire avant de comparer : les
 * garder produirait un en-tête `Basic` qui ne correspond à rien, et le client
 * lirait « mot de passe incorrect » avec le bon mot de passe.
 */
export const appPassword = (value: string) => value.replace(/\s+/g, "");

/**
 * L'hôte d'administration d'une boutique Shopify.
 *
 * L'API Admin ne répond que sur `*.myshopify.com`, jamais sur le domaine de
 * vente. Le client, lui, colle ce qu'il connaît : sa poignée seule, l'adresse
 * de son administration, parfois son domaine public. Les deux premiers cas se
 * ramènent au bon hôte ; le troisième ressort en phrase claire plutôt qu'en
 * 404 illisible.
 */
const shopHost = (value: string) => {
  const raw = value.trim().replace(/^https?:\/\//, "").toLowerCase();
  if (!raw) throw new AppError("Domaine de boutique manquant.", "BAD_CREDENTIALS", 400);

  // L'adresse que le client a sous les yeux quand il administre sa boutique.
  const admin = raw.match(/^admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  if (admin) return `${admin[1]}.myshopify.com`;

  const host = raw.replace(/\/.*$/, "");
  if (host.endsWith(".myshopify.com")) return host;
  if (!host.includes(".")) return `${host}.myshopify.com`;

  throw new AppError(
    `L'API Shopify ne répond que sur une adresse « .myshopify.com » : « ${host} » est le domaine public de la boutique. L'adresse d'administration se lit dans Shopify, rubrique Paramètres › Domaines.`,
    "BAD_CREDENTIALS",
    400,
  );
};

const SHOPIFY_API = "2026-01";

/**
 * Un appel GraphQL à l'Admin API de Shopify.
 *
 * Shopify a fait passer son API REST en héritage : les nouveaux points d'entrée
 * n'y arrivent plus, et rien ne garantit qu'une version d'API la serve encore
 * dans deux ans. Tout ce qui écrit dans la boutique passe donc par GraphQL.
 *
 * Une erreur GraphQL revient dans un corps en HTTP 200 : sans cette lecture,
 * un article refusé serait compté comme publié.
 */
export async function shopifyGraphql<T>(
  credentials: Credentials,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const host = shopHost(credentials.shopDomain ?? "");
  const response = await call(`https://${host}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": credentials.adminAccessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    // Shopify plafonne le débit de chaque boutique : au-delà, elle répond 429.
    // Ce n'est pas un jeton invalide, et le dire évite au client d'aller en
    // régénérer un pour rien.
    if (response.status === 429) {
      throw new AppError(
        "Shopify limite temporairement les appels à cette boutique. Réessayez dans une minute.",
        "SHOPIFY_THROTTLED",
        429,
      );
    }
    throw new AppError(await shortError(response), "SHOPIFY_HTTP", 502);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) {
    throw new AppError(
      payload.errors.map((error) => error.message ?? "erreur").join(" · "),
      "SHOPIFY_GRAPHQL",
      502,
    );
  }
  if (!payload.data) throw new AppError("Réponse Shopify vide.", "SHOPIFY_GRAPHQL", 502);
  return payload.data;
}

/** Le jeton d'un instant pour l'Admin API de Ghost, signé depuis la clé du client. */
async function ghostToken(adminApiKey: string): Promise<string> {
  const [id, secret] = adminApiKey.split(":");
  if (!id || !secret) throw new AppError("Clé Ghost au mauvais format.", "BAD_CREDENTIALS", 400);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", kid: id })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("/admin/")
    .sign(Buffer.from(secret, "hex"));
}

// ── Vérification ─────────────────────────────────────────────────────────────

export async function verifyConnection(
  platform: string,
  credentials: Credentials,
): Promise<VerifyResult> {
  try {
    switch (platform) {
      case "wordpress":
      case "woocommerce": {
        const site = wpSite(credentials.siteUrl ?? "");

        // WordPress désactive les mots de passe d'application sur une connexion
        // en clair : la connexion échouerait sans que rien ne dise pourquoi.
        if (site.startsWith("http://")) {
          return {
            ok: false,
            capabilities: [],
            siteUrl: site,
            error:
              "WordPress refuse les mots de passe d'application sur une connexion non chiffrée : passez le site en HTTPS avant de le rattacher.",
          };
        }

        // `context=edit` n'est servi qu'à un compte qui a le droit de modifier.
        // Un abonné reçoit 403 ici — exactement ce qu'il faut savoir avant de
        // promettre au client que ses articles partiront tout seuls.
        const response = await call(`${site}/wp-json/wp/v2/users/me?context=edit`, {
          headers: {
            Authorization: basic(
              credentials.username.trim(),
              appPassword(credentials.applicationPassword),
            ),
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          return {
            ok: false,
            capabilities: [],
            siteUrl: site,
            error: await wordpressError(response),
          };
        }

        const me = (await response.json().catch(() => null)) as {
          capabilities?: Record<string, boolean>;
        } | null;

        // Un compte sans `publish_posts` ouvrirait le lien pour le refermer au
        // premier article : le rattachement reste bon, mais on n'annonce que la
        // correction. Absence de la clé vaut oui — les anciens WordPress ne
        // renvoient pas toujours la liste.
        const canPublish = me?.capabilities?.publish_posts !== false;
        return {
          ok: true,
          capabilities: canPublish ? ["publish", "edit"] : ["edit"],
          siteUrl: site,
        };
      }

      case "shopify": {
        const host = shopHost(credentials.shopDomain ?? "");
        // L'appel d'essai passe par GraphQL : c'est la porte que la publication
        // et les corrections empruntent ensuite. Un jeton qui ouvre l'ancienne
        // API REST mais pas celle-ci n'est pas un lien utilisable.
        //
        // Les blogs sont demandés dans le même appel, exprès : ils exigent la
        // portée `read_content`. Un jeton qui ne l'a pas passerait la
        // vérification pour échouer au premier article, des semaines plus tard.
        const { shop, blogs } = await shopifyGraphql<{
          shop: { primaryDomain?: { url?: string } };
          blogs: { nodes: { handle: string }[] };
        }>(
          credentials,
          `query { shop { primaryDomain { url } } blogs(first: 1) { nodes { handle } } }`,
        );

        // Une boutique sans aucun blog reste rattachable — les métachamps SEO
        // s'écrivent quand même — mais il n'y a nulle part où déposer un
        // article, et l'interface ne doit pas le promettre.
        const hasBlog = blogs.nodes.length > 0;
        return {
          ok: true,
          capabilities: hasBlog ? ["publish", "edit"] : ["edit"],
          siteUrl: shop.primaryDomain?.url ?? `https://${host}`,
        };
      }

      case "ghost": {
        const site = trimSlash(credentials.siteUrl ?? "");
        const token = await ghostToken(credentials.adminApiKey);
        const response = await call(`${site}/ghost/api/admin/site/`, {
          headers: { Authorization: `Ghost ${token}` },
        });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: site, error: await shortError(response) };
        }
        return { ok: true, capabilities: ["publish", "edit"], siteUrl: site };
      }

      case "webflow": {
        const response = await call(`https://api.webflow.com/v2/sites/${credentials.siteId}`, {
          headers: { Authorization: `Bearer ${credentials.apiToken}` },
        });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: null, error: await shortError(response) };
        }
        const payload = (await response.json()) as { customDomains?: { url?: string }[] };
        const domain = payload.customDomains?.[0]?.url ?? null;
        // Déposer un article chez Webflow suppose de désigner une collection CMS
        // et d'en connaître les champs : tant que ce choix n'est pas demandé au
        // client, le lien ne sert qu'aux corrections.
        return {
          ok: true,
          capabilities: ["edit"],
          siteUrl: domain ? `https://${domain}` : null,
        };
      }

      case "wix": {
        const response = await call("https://www.wixapis.com/blog/v3/posts?paging.limit=1", {
          headers: {
            Authorization: credentials.apiKey,
            "wix-site-id": credentials.siteId,
          },
        });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: null, error: await shortError(response) };
        }
        return { ok: true, capabilities: ["edit"], siteUrl: null };
      }

      case "squarespace":
      case "prestashop":
      case "framer": {
        // Ces trois-là n'ouvrent pas la rédaction à une API tierce. Le lien est
        // accepté pour les corrections on-page, et l'on ne promet pas la
        // publication automatique.
        const site = trimSlash(credentials.siteUrl ?? "");
        const response = await call(site, { method: "HEAD" });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: site, error: await shortError(response) };
        }
        return { ok: true, capabilities: ["edit"], siteUrl: site };
      }

      case "custom": {
        const site = trimSlash(credentials.siteUrl ?? "");
        const hook = credentials.webhookUrl ? trimSlash(credentials.webhookUrl) : null;
        const response = await call(site, { method: "HEAD" });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: site, error: await shortError(response) };
        }
        // Sans webhook, rien à appeler pour déposer un article : il reste la
        // correction, que l'agent livre sous forme de patch à appliquer.
        return {
          ok: true,
          capabilities: hook ? ["publish", "edit"] : ["edit"],
          siteUrl: site,
        };
      }

      default:
        return { ok: false, capabilities: [], siteUrl: null, error: "Plateforme inconnue." };
    }
  } catch (error) {
    return {
      ok: false,
      capabilities: [],
      siteUrl: null,
      error: error instanceof Error ? error.message : "Connexion impossible.",
    };
  }
}

/**
 * Ce qui s'est réellement passé quand WordPress refuse, dit au client.
 *
 * Les deux refus les plus fréquents n'ont rien à voir avec le mot de passe. Un
 * hébergement Apache en CGI retire l'en-tête `Authorization` avant que PHP ne
 * le voie : le site répond alors « non connecté » avec des identifiants
 * parfaitement valides. Et une extension de sécurité ferme volontiers
 * `/wp-json`. Renvoyer le code brut enverrait le client vérifier son mot de
 * passe pendant une heure, pour rien.
 */
async function wordpressError(response: Response): Promise<string> {
  const detail = await shortError(response);

  if (response.status === 401) {
    return `${detail} — si le mot de passe d'application est bon, l'hébergeur retire probablement l'en-tête « Authorization » : ajoutez la directive CGIPassAuth au fichier .htaccess du site.`;
  }
  if (response.status === 403) {
    return `${detail} — ce compte WordPress n'a pas le droit de publier : utilisez un compte administrateur ou éditeur.`;
  }
  if (response.status === 404) {
    return `${detail} — l'API REST de WordPress ne répond pas sur /wp-json : elle est désactivée, ou une extension de sécurité la bloque.`;
  }
  return detail;
}

/** Le message d'erreur de la plateforme, réduit à ce qui tient sur une ligne. */
async function shortError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return clean ? `${response.status} : ${clean}` : `Réponse ${response.status}.`;
}

// ── Publication ──────────────────────────────────────────────────────────────

export async function publishArticle(
  platform: string,
  credentials: Credentials,
  input: PublishInput,
): Promise<PublishResult> {
  // Les articles sont stockés en Markdown ; aucun CMS d'ici ne le lit. Déposé
  // tel quel, le texte s'affichait chez le client avec ses dièses et ses
  // astérisques : la conversion se fait donc en un seul endroit, à la porte.
  const article = { ...input, body: markdownToHtml(input.body) };

  switch (platform) {
    case "wordpress":
    case "woocommerce": {
      const site = wpSite(credentials.siteUrl ?? "");
      const response = await call(`${site}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          Authorization: basic(
            credentials.username.trim(),
            appPassword(credentials.applicationPassword),
          ),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: article.title,
          content: article.body,
          excerpt: article.excerpt ?? "",
          slug: article.slug ?? undefined,
          status: "publish",
        }),
      });
      if (!response.ok) throw new AppError(await wordpressError(response), "PUBLISH_FAILED", 502);

      const payload = (await response.json()) as { id?: number; link?: string };
      return { url: payload.link ?? null, externalId: payload.id ? String(payload.id) : null };
    }

    case "shopify": {
      // Shopify range les articles dans un blog, et une boutique en a au moins
      // un (« News ») créé d'office. Le client peut en désigner un autre par sa
      // poignée ; sans indication, on écrit dans le premier.
      //
      // Le nom de la boutique voyage dans le même appel : `author` est déclaré
      // non nul dans le schéma de création, et sans lui Shopify rejette la
      // requête avant même de la lire.
      const { shop, blogs } = await shopifyGraphql<{
        shop: { name: string; primaryDomain?: { url?: string } };
        blogs: { nodes: { id: string; handle: string }[] };
      }>(
        credentials,
        `query { shop { name primaryDomain { url } } blogs(first: 50) { nodes { id handle } } }`,
      );

      const wanted = credentials.blogHandle?.trim().toLowerCase();
      const blog = wanted
        ? blogs.nodes.find((node) => node.handle.toLowerCase() === wanted)
        : blogs.nodes[0];

      if (!blog) {
        throw new AppError(
          wanted
            ? `Aucun blog « ${wanted} » sur cette boutique.`
            : "Aucun blog sur cette boutique : créez-en un dans Shopify, rubrique Boutique en ligne › Articles de blog.",
          "PUBLISH_FAILED",
          502,
        );
      }

      const created = await shopifyGraphql<{
        articleCreate: {
          article: { id: string; handle: string; blog: { handle: string } } | null;
          userErrors: { message?: string }[];
        };
      }>(
        credentials,
        `mutation Publish($article: ArticleCreateInput!) {
          articleCreate(article: $article) {
            article { id handle blog { handle } }
            userErrors { field message }
          }
        }`,
        {
          article: {
            blogId: blog.id,
            title: article.title,
            // Obligatoire côté Shopify. À défaut de signature portée par
            // l'article, la boutique signe de son propre nom.
            author: { name: article.author?.trim() || shop.name },
            body: article.body,
            summary: article.excerpt ?? undefined,
            handle: article.slug ?? undefined,
            isPublished: true,
          },
        },
      );

      const errors = created.articleCreate.userErrors;
      if (errors.length > 0) {
        throw new AppError(
          errors.map((error) => error.message ?? "refusé").join(" · "),
          "PUBLISH_FAILED",
          502,
        );
      }

      const published = created.articleCreate.article;
      if (!published) throw new AppError("Shopify n'a rien créé.", "PUBLISH_FAILED", 502);

      // L'article se lit sur le domaine de vente, pas sur l'adresse
      // d'administration : c'est ce lien-là que le client ouvrira.
      const home = trimSlash(
        shop.primaryDomain?.url ?? `https://${shopHost(credentials.shopDomain ?? "")}`,
      );
      return {
        url: `${home}/blogs/${published.blog.handle}/${published.handle}`,
        externalId: published.id,
      };
    }

    case "ghost": {
      const site = trimSlash(credentials.siteUrl ?? "");
      const token = await ghostToken(credentials.adminApiKey);
      const response = await call(`${site}/ghost/api/admin/posts/?source=html`, {
        method: "POST",
        headers: { Authorization: `Ghost ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: [
            {
              title: article.title,
              html: article.body,
              custom_excerpt: article.excerpt ?? undefined,
              slug: article.slug ?? undefined,
              status: "published",
            },
          ],
        }),
      });
      if (!response.ok) throw new AppError(await shortError(response), "PUBLISH_FAILED", 502);

      const payload = (await response.json()) as { posts?: { id?: string; url?: string }[] };
      return { url: payload.posts?.[0]?.url ?? null, externalId: payload.posts?.[0]?.id ?? null };
    }

    case "custom": {
      const hook = credentials.webhookUrl ? trimSlash(credentials.webhookUrl) : null;
      if (!hook) {
        throw new AppError(
          "Ce site n'a pas de webhook de publication : l'article reste à déposer à la main.",
          "PUBLISH_UNSUPPORTED",
          400,
        );
      }

      const response = await call(hook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.apiToken ? { Authorization: `Bearer ${credentials.apiToken}` } : {}),
        },
        body: JSON.stringify(article),
      });
      if (!response.ok) throw new AppError(await shortError(response), "PUBLISH_FAILED", 502);

      const payload = (await response.json().catch(() => ({}))) as { url?: string; id?: string };
      return { url: payload.url ?? null, externalId: payload.id ?? null };
    }

    default:
      throw new AppError(
        "Cette plateforme n'ouvre pas sa publication à une API : l'article est à copier dans son éditeur.",
        "PUBLISH_UNSUPPORTED",
        400,
      );
  }
}
