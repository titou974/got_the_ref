/**
 * Vérifie, avant une mise en production, que le rattachement des sites clients
 * peut réellement fonctionner : les clés d'environnement, puis un appel d'essai
 * vers un vrai WordPress ou une vraie boutique Shopify.
 *
 *   node scripts/check-site-connection.mjs
 *   node scripts/check-site-connection.mjs --wordpress https://exemple.fr --user titouan --password "abcd EFGH ijkl mnop qrst uvwx"
 *   node scripts/check-site-connection.mjs --shopify ma-boutique.myshopify.com --token shpat_...
 *   node scripts/check-site-connection.mjs --cron https://exemple.fr
 *
 * Le script refait à la main ce que `features/dashboard/connectors` fait dans
 * l'application — c'est voulu. Il tourne sans base, sans session et sans build :
 * on peut l'exécuter depuis un poste ou depuis le serveur pour savoir si le
 * refus vient des identifiants, de l'hébergeur du client ou de notre
 * configuration. Ses messages sont donc des diagnostics, pas des textes
 * d'interface.
 *
 * Aucun appel facturé : tout ce qui part ici est en lecture.
 */

import "dotenv/config";

const TIMEOUT_MS = 15_000;

const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message) => console.log(`  ✗ ${message}`);
const info = (message) => console.log(`    ${message}`);

let failures = 0;
const fail = (message) => {
  failures += 1;
  ko(message);
};

/** Lit une option `--nom valeur`. */
function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "";
}

const has = (name) => process.argv.includes(`--${name}`);

async function call(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

async function shortBody(response) {
  const text = await response.text().catch(() => "");
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

// ── 1. L'environnement ───────────────────────────────────────────────────────

function checkEnvironment() {
  console.log("\nEnvironnement");

  const key = process.env.CREDENTIALS_KEY ?? "";
  if (!key) {
    fail(
      "CREDENTIALS_KEY absente : le serveur refusera tout rattachement (« Le stockage sécurisé des identifiants n'est pas configuré »).",
    );
    info("Générer : openssl rand -base64 32");
  } else if (key.length < 32) {
    fail(`CREDENTIALS_KEY trop courte (${key.length} caractères, 32 minimum).`);
  } else {
    ok(`CREDENTIALS_KEY présente (${key.length} caractères).`);
  }

  const cron = process.env.CRON_SECRET ?? "";
  if (!cron) {
    fail("CRON_SECRET absent : /api/cron/publish répondra 503 et aucun article programmé ne partira.");
    info("Générer : openssl rand -base64 32");
  } else {
    ok(`CRON_SECRET présent (${cron.length} caractères).`);
  }
}

// ── 2. WordPress ─────────────────────────────────────────────────────────────

async function checkWordPress(rawSite, username, password) {
  console.log("\nWordPress");

  const withScheme = /^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`;
  const site = withScheme
    .replace(/\/(wp-admin|wp-login\.php|wp-json)(\/.*)?$/i, "")
    .replace(/\/+$/, "");

  if (site.startsWith("http://")) {
    fail("Site en HTTP : WordPress désactive les mots de passe d'application hors HTTPS.");
    return;
  }
  ok(`Adresse normalisée : ${site}`);

  // L'API REST répond-elle seulement, sans authentification ?
  try {
    const root = await call(`${site}/wp-json/`, { headers: { Accept: "application/json" } });
    if (root.ok) {
      ok("API REST joignable sur /wp-json/.");
    } else {
      fail(`API REST : ${root.status}. Elle est désactivée, ou une extension de sécurité la bloque.`);
      info(await shortBody(root));
      return;
    }
  } catch (error) {
    fail(`API REST injoignable : ${error.message}`);
    return;
  }

  // Le mot de passe d'application est affiché en groupes séparés par des
  // espaces ; WordPress les retire avant de comparer, nous aussi.
  const secret = password.replace(/\s+/g, "");
  const authorization = `Basic ${Buffer.from(`${username.trim()}:${secret}`).toString("base64")}`;

  const response = await call(`${site}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: authorization, Accept: "application/json" },
  });

  if (response.status === 401) {
    fail("401 : identifiants refusés.");
    info(
      "Si le mot de passe d'application est bon, l'hébergeur retire l'en-tête « Authorization » avant PHP.",
    );
    info("Correctif côté client, dans le .htaccess : CGIPassAuth On");
    info(await shortBody(response));
    return;
  }
  if (response.status === 403) {
    fail("403 : ce compte n'a pas le droit de modifier. Utilisez un administrateur ou un éditeur.");
    return;
  }
  if (!response.ok) {
    fail(`Refus ${response.status} : ${await shortBody(response)}`);
    return;
  }

  const me = await response.json();
  ok(`Authentifié comme « ${me.name ?? me.slug ?? username} » (id ${me.id}).`);

  const capabilities = me.capabilities ?? {};
  if (capabilities.publish_posts === false) {
    fail("Ce compte ne peut pas publier : les articles resteront à déposer à la main.");
  } else {
    ok("Droit de publier des articles confirmé.");
  }

  // La page d'accueil statique conditionne les corrections on-page.
  const settings = await call(`${site}/wp-json/wp/v2/settings`, {
    headers: { Authorization: authorization, Accept: "application/json" },
  });
  if (settings.ok) {
    const value = await settings.json();
    if (value.show_on_front === "page" && value.page_on_front) {
      ok(`Page d'accueil statique (id ${value.page_on_front}) : les corrections on-page s'appliqueront.`);
    } else {
      ko("Accueil réglé sur « derniers articles » : le H1 et le premier paragraphe resteront manuels.");
      info("Réglages → Lecture → « Une page statique » pour ouvrir les corrections on-page.");
    }
  }
}

// ── 3. Shopify ───────────────────────────────────────────────────────────────

async function shopifyGraphql(host, token, query) {
  const response = await call(`https://${host}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} : ${await shortBody(response)}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(" · "));
  }
  return payload.data;
}

async function checkShopify(rawShop, token) {
  console.log("\nShopify");

  const raw = rawShop.trim().replace(/^https?:\/\//, "").toLowerCase();
  const admin = raw.match(/^admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  const bare = raw.replace(/\/.*$/, "");
  const host = admin
    ? `${admin[1]}.myshopify.com`
    : bare.endsWith(".myshopify.com")
      ? bare
      : !bare.includes(".")
        ? `${bare}.myshopify.com`
        : null;

  if (!host) {
    fail(`« ${bare} » est le domaine de vente : l'API Admin ne répond que sur « .myshopify.com ».`);
    return;
  }
  ok(`Hôte d'administration : ${host}`);

  // Les portées accordées au jeton : c'est la réponse la plus utile en cas de
  // refus, et elle ne demande elle-même aucune portée.
  try {
    const data = await shopifyGraphql(
      host,
      token,
      "query { currentAppInstallation { accessScopes { handle } } }",
    );
    const scopes = (data.currentAppInstallation?.accessScopes ?? []).map((scope) => scope.handle);
    ok(`Portées du jeton : ${scopes.join(", ") || "aucune"}`);

    for (const needed of ["read_content", "write_content"]) {
      if (scopes.includes(needed)) ok(`${needed} accordée.`);
      else fail(`${needed} manquante : la publication d'articles échouera.`);
    }
  } catch (error) {
    fail(`Jeton refusé : ${error.message}`);
    return;
  }

  try {
    const data = await shopifyGraphql(
      host,
      token,
      "query { shop { name primaryDomain { url } } blogs(first: 20) { nodes { handle title } } }",
    );
    ok(`Boutique « ${data.shop.name} » — ${data.shop.primaryDomain?.url ?? "domaine inconnu"}`);

    const blogs = data.blogs.nodes;
    if (blogs.length === 0) {
      fail("Aucun blog : créez-en un (Boutique en ligne → Articles de blog) pour publier.");
    } else {
      ok(`Blogs disponibles : ${blogs.map((blog) => blog.handle).join(", ")}`);
      info(`Sans « blogHandle » renseigné, les articles iront dans « ${blogs[0].handle} ».`);
    }
  } catch (error) {
    fail(`Lecture de la boutique refusée : ${error.message}`);
  }
}

// ── 4. La tâche planifiée, telle qu'elle est déployée ────────────────────────

async function checkCron(baseUrl) {
  console.log("\nTâche planifiée");

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    fail("CRON_SECRET absent de cet environnement : impossible de tester la route.");
    return;
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/api/cron/publish`;

  // Sans en-tête, la route doit refuser. Un 200 ici serait une porte ouverte.
  const anonymous = await call(url);
  if (anonymous.status === 401 || anonymous.status === 503) {
    ok(`Route fermée aux appels anonymes (${anonymous.status}).`);
  } else {
    fail(`Route accessible sans secret (${anonymous.status}) : elle publierait chez vos clients.`);
  }

  // Attention : cet appel publie réellement les articles arrivés à échéance.
  if (!has("run")) {
    info("Ajoutez --run pour déclencher un vrai passage (il publiera les articles dus).");
    return;
  }

  const authorized = await call(url, { headers: { Authorization: `Bearer ${secret}` } });
  if (!authorized.ok) {
    fail(`Passage refusé (${authorized.status}) : ${await shortBody(authorized)}`);
    return;
  }
  ok(`Passage effectué : ${await shortBody(authorized)}`);
}

// ── Déroulé ──────────────────────────────────────────────────────────────────

checkEnvironment();

const wordpress = arg("wordpress");
if (wordpress !== null) {
  const user = arg("user");
  const password = arg("password");
  if (!wordpress || !user || !password) {
    fail("Usage : --wordpress https://exemple.fr --user identifiant --password \"mot de passe d'application\"");
  } else {
    await checkWordPress(wordpress, user, password);
  }
}

const shopify = arg("shopify");
if (shopify !== null) {
  const token = arg("token");
  if (!shopify || !token) {
    fail("Usage : --shopify ma-boutique.myshopify.com --token shpat_...");
  } else {
    await checkShopify(shopify, token);
  }
}

const cron = arg("cron");
if (cron !== null) {
  if (!cron) fail("Usage : --cron https://exemple.fr");
  else await checkCron(cron);
}

console.log(
  failures === 0
    ? "\nTout est en place.\n"
    : `\n${failures} point${failures > 1 ? "s" : ""} à corriger avant la mise en production.\n`,
);
process.exit(failures === 0 ? 0 : 1);
