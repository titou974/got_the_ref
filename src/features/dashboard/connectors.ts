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
};

export type PublishResult = { url: string | null; externalId: string | null };

const trimSlash = (value: string) => value.replace(/\/+$/, "");

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

/** L'hôte d'une boutique Shopify, avec ou sans le `.myshopify.com` déjà écrit. */
const shopHost = (value: string) => {
  const host = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return host.includes(".") ? host : `${host}.myshopify.com`;
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
  const response = await fetch(`https://${host}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": credentials.adminAccessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError(await shortError(response), "SHOPIFY_HTTP", 502);

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
        const site = trimSlash(credentials.siteUrl ?? "");
        const response = await fetch(`${site}/wp-json/wp/v2/users/me?context=edit`, {
          headers: { Authorization: basic(credentials.username, credentials.applicationPassword) },
          cache: "no-store",
        });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: site, error: await shortError(response) };
        }
        return { ok: true, capabilities: ["publish", "edit"], siteUrl: site };
      }

      case "shopify": {
        const host = shopHost(credentials.shopDomain ?? "");
        // L'appel d'essai passe par GraphQL : c'est la porte que la publication
        // et les corrections empruntent ensuite. Un jeton qui ouvre l'ancienne
        // API REST mais pas celle-ci n'est pas un lien utilisable.
        const { shop } = await shopifyGraphql<{
          shop: { primaryDomain?: { url?: string } };
        }>(credentials, `query { shop { primaryDomain { url } } }`);

        return {
          ok: true,
          capabilities: ["publish", "edit"],
          siteUrl: shop.primaryDomain?.url ?? `https://${host}`,
        };
      }

      case "ghost": {
        const site = trimSlash(credentials.siteUrl ?? "");
        const token = await ghostToken(credentials.adminApiKey);
        const response = await fetch(`${site}/ghost/api/admin/site/`, {
          headers: { Authorization: `Ghost ${token}` },
          cache: "no-store",
        });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: site, error: await shortError(response) };
        }
        return { ok: true, capabilities: ["publish", "edit"], siteUrl: site };
      }

      case "webflow": {
        const response = await fetch(`https://api.webflow.com/v2/sites/${credentials.siteId}`, {
          headers: { Authorization: `Bearer ${credentials.apiToken}` },
          cache: "no-store",
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
        const response = await fetch("https://www.wixapis.com/blog/v3/posts?paging.limit=1", {
          headers: {
            Authorization: credentials.apiKey,
            "wix-site-id": credentials.siteId,
          },
          cache: "no-store",
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
        const response = await fetch(site, { method: "HEAD", cache: "no-store" });
        if (!response.ok) {
          return { ok: false, capabilities: [], siteUrl: site, error: await shortError(response) };
        }
        return { ok: true, capabilities: ["edit"], siteUrl: site };
      }

      case "custom": {
        const site = trimSlash(credentials.siteUrl ?? "");
        const hook = credentials.webhookUrl ? trimSlash(credentials.webhookUrl) : null;
        const response = await fetch(site, { method: "HEAD", cache: "no-store" });
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
      const site = trimSlash(credentials.siteUrl ?? "");
      const response = await fetch(`${site}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          Authorization: basic(credentials.username, credentials.applicationPassword),
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
      if (!response.ok) throw new AppError(await shortError(response), "PUBLISH_FAILED", 502);

      const payload = (await response.json()) as { id?: number; link?: string };
      return { url: payload.link ?? null, externalId: payload.id ? String(payload.id) : null };
    }

    case "shopify": {
      // Shopify range les articles dans un blog, et une boutique en a au moins
      // un (« News ») créé d'office. On écrit dans le premier.
      const { blogs } = await shopifyGraphql<{ blogs: { nodes: { id: string }[] } }>(
        credentials,
        `query { blogs(first: 1) { nodes { id } } }`,
      );
      const blogId = blogs.nodes[0]?.id;
      if (!blogId) throw new AppError("Aucun blog sur cette boutique.", "PUBLISH_FAILED", 502);

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
            blogId,
            title: article.title,
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

      const host = shopHost(credentials.shopDomain ?? "");
      return {
        url: `https://${host}/blogs/${published.blog.handle}/${published.handle}`,
        externalId: published.id,
      };
    }

    case "ghost": {
      const site = trimSlash(credentials.siteUrl ?? "");
      const token = await ghostToken(credentials.adminApiKey);
      const response = await fetch(`${site}/ghost/api/admin/posts/?source=html`, {
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

      const response = await fetch(hook, {
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
