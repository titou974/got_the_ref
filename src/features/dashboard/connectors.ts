import "server-only";

import { SignJWT } from "jose";
import { AppError } from "@/lib/errors";
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
        const response = await fetch(`https://${host}/admin/api/${SHOPIFY_API}/shop.json`, {
          headers: { "X-Shopify-Access-Token": credentials.adminAccessToken },
          cache: "no-store",
        });
        if (!response.ok) {
          return {
            ok: false,
            capabilities: [],
            siteUrl: `https://${host}`,
            error: await shortError(response),
          };
        }
        const payload = (await response.json()) as { shop?: { domain?: string } };
        return {
          ok: true,
          capabilities: ["publish", "edit"],
          siteUrl: payload.shop?.domain ? `https://${payload.shop.domain}` : `https://${host}`,
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
  article: PublishInput,
): Promise<PublishResult> {
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
      const host = shopHost(credentials.shopDomain ?? "");
      const headers = {
        "X-Shopify-Access-Token": credentials.adminAccessToken,
        "Content-Type": "application/json",
      };

      // Shopify range les articles dans un blog, et une boutique en a au moins
      // un (« News ») créé d'office. On écrit dans le premier.
      const blogs = await fetch(`https://${host}/admin/api/${SHOPIFY_API}/blogs.json?limit=1`, {
        headers,
        cache: "no-store",
      });
      if (!blogs.ok) throw new AppError(await shortError(blogs), "PUBLISH_FAILED", 502);

      const blogId = ((await blogs.json()) as { blogs?: { id?: number }[] }).blogs?.[0]?.id;
      if (!blogId) throw new AppError("Aucun blog sur cette boutique.", "PUBLISH_FAILED", 502);

      const response = await fetch(
        `https://${host}/admin/api/${SHOPIFY_API}/blogs/${blogId}/articles.json`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            article: {
              title: article.title,
              body_html: article.body,
              summary_html: article.excerpt ?? undefined,
              handle: article.slug ?? undefined,
              published: true,
            },
          }),
        },
      );
      if (!response.ok) throw new AppError(await shortError(response), "PUBLISH_FAILED", 502);

      const payload = (await response.json()) as {
        article?: { id?: number; handle?: string };
      };
      return {
        url: payload.article?.handle ? `https://${host}/blogs/news/${payload.article.handle}` : null,
        externalId: payload.article?.id ? String(payload.article.id) : null,
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
