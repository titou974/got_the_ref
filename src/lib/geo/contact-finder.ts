import "server-only";

import * as cheerio from "cheerio";
import { z } from "zod";
import { askGeminiGrounded, isGeminiConfigured } from "@/lib/ai/gemini";
import { fetchPublicPage, type PublicPage } from "./fetcher";
import { geoLog } from "./log";

/**
 * Où écrire à un site qu'on veut démarcher.
 *
 * Le modèle qui dresse la liste des sites connaît leur existence, pas l'adresse
 * exacte de leur page contact : il rendait `null` neuf fois sur dix, ou une URL
 * de mémoire qui répond 404. Or la page existe presque toujours — taper
 * « guide michelin contact » la donne en premier résultat. Ce module va la
 * chercher pour de bon, dans cet ordre :
 *
 *  1. le site lui-même : le lien « Contact » du pied de page, suivi et vérifié ;
 *  2. les chemins usuels (`/contact`, `/nous-contacter`, `/contact-us`…) ;
 *  3. Gemini avec la recherche Google, en un seul appel pour tous les sites qui
 *     résistent — c'est la requête que l'humain taperait, posée au seul modèle
 *     du produit relié à un index.
 *
 * Une URL n'est retenue que si elle répond et que la page ressemble vraiment à
 * une page de contact (formulaire, adresse, téléphone). Un gros site derrière
 * un pare-feu anti-robot répond 403 à notre agent : dans ce cas seulement, une
 * URL du bon domaine dont le chemin dit « contact » est gardée sans lecture,
 * parce qu'un lien à ouvrir vaut mieux qu'une case vide.
 */

/** L'adresse trouvée pour un site, et par quel moyen. */
export type ContactPoint = {
  url: string | null;
  email: string | null;
  /** `site` (lien du site), `path` (chemin usuel), `search` (Gemini), ou `null`. */
  source: "site" | "path" | "search" | null;
};

const EMPTY: ContactPoint = { url: null, email: null, source: null };

/** Un lien qui mène à une prise de contact directe. */
const CONTACT_WORD =
  /(contact|nous[-_ ]?ecrire|nous[-_ ]?contacter|ecrivez[-_ ]?nous|contactez|get[-_ ]?in[-_ ]?touch|write[-_ ]?to[-_ ]?us|kontakt|contatti|contacto)/i;

/**
 * Un lien qui mène plus loin, mais où l'adresse se trouve souvent quand même.
 *
 * Ces mots reviennent aussi dans les titres d'articles — « partenariat
 * privilégié entre le Guide Michelin et TheFork » est un billet de blog, pas un
 * contact. Ils ne sont donc retenus que sur un chemin court (voir
 * `looksLikeSection`).
 */
const FALLBACK_WORD =
  /(presse|press[-_ ]?room|media|partenariat|partner|collaborat|redaction|editorial|proposer[-_ ]?un[-_ ]?article|mentions[-_ ]?legales|impressum|a[-_ ]?propos|qui[-_ ]?sommes)/i;

/** Les chemins que tentent tous les sites du monde, du plus courant au moins. */
const GUESS_PATHS = [
  "/contact",
  "/contact-us",
  "/nous-contacter",
  "/contactez-nous",
  "/fr/contact",
  "/en/contact",
  "/contacts",
  "/pages/contact",
  "/nous-ecrire",
  "/a-propos/contact",
];

/**
 * Ce qui ressemble à une adresse sans en être une : exemples de formulaire
 * (`nom@exemple.com`), boîtes qui ne lisent pas les réponses, adresses de
 * traçage glissées dans le code, et noms de fichiers image que la regex attrape
 * au passage.
 */
const EMAIL_NOISE =
  /(sentry|wixpress|example|exemple|domain\.com|votre|your|^nom@|^prenom|^adresse@|email@|no-?reply|nepasrepondre|donotreply|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|@2x)/i;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Le domaine enregistrable, à deux labels : `guide.michelin.com` → `michelin.com`. */
function rootDomain(host: string): string {
  const parts = host.replace(/^www\./i, "").toLowerCase().split(".");
  return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
}

/**
 * Le domaine nu d'une entrée qui peut arriver avec son schéma ou son chemin.
 *
 * C'est aussi la forme sous laquelle un site est enregistré et retrouvé : sans
 * `www.`, en minuscules, pour qu'une même publication ne tienne pas deux lignes.
 */
export function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

/** Vrai si l'URL appartient au site (sous-domaines compris). */
function belongsTo(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return rootDomain(host) === rootDomain(normalizeDomain(domain));
  } catch {
    return false;
  }
}

/** La première adresse e-mail exploitable d'une page, ou `null`. */
function emailIn(html: string, domain: string): string | null {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  $('a[href^="mailto:"]').each((_, el) => {
    const raw = ($(el).attr("href") ?? "").slice("mailto:".length).split("?")[0].trim();
    if (raw) candidates.push(decodeURIComponent(raw));
  });
  // Les adresses écrites en clair dans le texte viennent après celles des liens :
  // un `mailto:` est posé par le site, une chaîne dans le corps peut appartenir
  // à un tiers cité sur la page.
  candidates.push(...(html.match(EMAIL_RE) ?? []));

  const root = rootDomain(normalizeDomain(domain));
  const clean = candidates
    .map((value) => value.toLowerCase().trim())
    .filter((value) => value.includes("@") && !EMAIL_NOISE.test(value));

  // À domaine égal, l'adresse du site prime : `contact@michelin.com` plutôt que
  // l'agence de presse citée en bas de page.
  return (
    clean.find((value) => value.endsWith(`@${root}`) || value.endsWith(`.${root}`)) ??
    clean[0] ??
    null
  );
}

/** Une page qui ressemble à une page de contact, et pas à une 404 déguisée. */
function looksLikeContactPage(html: string): boolean {
  const $ = cheerio.load(html);
  const heading = `${$("title").first().text()} ${$("h1").first().text()}`;
  if (CONTACT_WORD.test(heading)) return true;
  if ($("form").length > 0 && html.length > 800) return true;
  return $('a[href^="mailto:"]').length > 0 || $('a[href^="tel:"]').length > 0;
}

/** Le chemin dit-il « contact » ? Sert quand la page ne se laisse pas lire. */
function pathSaysContact(url: string): boolean {
  try {
    return CONTACT_WORD.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Un chemin de rubrique — `/presse`, `/a-propos` — et non un article qui parle
 * de presse. Un titre d'article devient un chemin long, à rallonge de tirets ;
 * une rubrique tient en un ou deux segments courts.
 */
function looksLikeSection(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) return false;
  const last = segments[segments.length - 1];
  return last.length <= 32 && last.split("-").length <= 3;
}

/** Les liens de contact d'une page, du plus direct au plus lointain. */
function contactLinksIn(html: string, pageUrl: string, domain: string): string[] {
  const $ = cheerio.load(html);
  const scored = new Map<string, number>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return;

    let absolute: string;
    let path: string;
    try {
      const parsed = new URL(href, pageUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      path = parsed.pathname.replace(/\/$/, "");
      absolute = parsed.origin + path + parsed.search;
    } catch {
      return;
    }
    if (!path || !belongsTo(absolute, domain)) return;
    // `lebonbon.fr/null/contact` : un gabarit qui n'a pas reçu sa ville. Le lien
    // s'ouvre, mais l'adresse est bancale et ne se recopie pas dans un e-mail.
    if (/\/(null|undefined)(\/|$)/i.test(path)) return;

    const label = $(el).text().replace(/\s+/g, " ").trim().slice(0, 80);
    const depth = path.split("/").filter(Boolean).length;
    let score = 0;
    if (CONTACT_WORD.test(path)) score = 100;
    // Un libellé « Contact » suffit, tant qu'il ne pointe pas au fond du site :
    // au-delà de trois segments, c'est une page d'aide ou un article.
    else if (CONTACT_WORD.test(label) && depth <= 3) score = 90;
    else if (looksLikeSection(path) && (FALLBACK_WORD.test(path) || FALLBACK_WORD.test(label)))
      score = 40;
    if (score === 0) return;

    // À égalité, le chemin le plus court gagne : `/contact` avant
    // `/aide/faq/contact-service-client`.
    score -= Math.min(20, depth * 4);
    scored.set(absolute, Math.max(scored.get(absolute) ?? 0, score));
  });

  return [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

/**
 * Une lecture de sondage : un seul essai, sept secondes.
 *
 * Le reste du produit lit une poignée d'adresses connues et peut se permettre
 * deux essais de quinze secondes. Ici on ouvre jusqu'à une dizaine d'adresses
 * par site pour vérifier lesquelles existent : au tarif habituel, douze sites
 * dépasseraient le budget de l'action avant d'avoir rendu la moindre fiche.
 */
function readPage(url: string, maxChars = 200_000): Promise<PublicPage | null> {
  return fetchPublicPage(url, maxChars, { attempts: 1, timeoutMs: 7000 });
}

/** Le corps d'une page lisible, ou `null` : redirection, refus, page absente. */
function bodyOf(page: PublicPage | null): string | null {
  return page && page.status >= 200 && page.status < 300 && page.body ? page.body : null;
}

/**
 * Un refus de robot, pas une page absente.
 *
 * Cloudflare rend 403 ou un 202 de défi, les pare-feux applicatifs 405 ou 429,
 * et la page derrière existe bel et bien — c'est celle qu'un humain ouvrira. Un
 * 404, lui, tranche : l'adresse est fausse, on ne la propose pas.
 */
function isBotWall(status: number): boolean {
  return [202, 401, 403, 405, 406, 429, 503].includes(status);
}

/**
 * Le contact lu sur le site lui-même : son lien « Contact », sinon les chemins
 * usuels. Rend `EMPTY` quand le site ne répond pas — c'est alors à la recherche
 * Google de prendre le relais.
 */
async function probeSite(domain: string): Promise<ContactPoint> {
  const host = normalizeDomain(domain);
  if (!host || !host.includes(".")) return EMPTY;

  const home = `https://${host}`;
  const html = bodyOf(await readPage(home, 300_000));
  const homeEmail = html ? emailIn(html, host) : null;
  const tried = new Set<string>();

  if (html) {
    // Deux candidats suffisent : au-delà, on paie des requêtes pour des liens
    // que le score a déjà jugés faibles.
    for (const candidate of contactLinksIn(html, home, host).slice(0, 2)) {
      tried.add(candidate);
      const page = await readPage(candidate);
      const body = bodyOf(page);
      if (body && looksLikeContactPage(body)) {
        return { url: candidate, email: emailIn(body, host) ?? homeEmail, source: "site" };
      }
      // Le lien est posé par le site lui-même et son chemin dit « contact » :
      // même quand le pare-feu nous refuse la lecture, il est bon à ouvrir.
      if (!body && pathSaysContact(candidate) && (!page || isBotWall(page.status))) {
        return { url: candidate, email: homeEmail, source: "site" };
      }
    }
  }

  // Le site a répondu et n'a pas de lien contact exploitable : trois chemins
  // suffisent à le prouver. S'il n'a pas répondu du tout, on essaie la liste
  // entière — l'accueil peut refuser les robots alors que `/contact` répond.
  // Tous partent ensemble, et l'ordre de la liste tranche : `/contact` avant
  // `/nous-ecrire`, quelle que soit la vitesse des serveurs.
  const guesses = GUESS_PATHS.slice(0, html ? 3 : GUESS_PATHS.length)
    .map((path) => `${home}${path}`)
    .filter((candidate) => !tried.has(candidate));

  const pages = await Promise.all(guesses.map((candidate) => readPage(candidate)));
  for (const [index, page] of pages.entries()) {
    const body = bodyOf(page);
    // Une adresse devinée n'est retenue que lue : sur un site qui refuse nos
    // requêtes, rien ne distingue un `/contact` qui existe d'un qui n'existe pas.
    if (body && looksLikeContactPage(body)) {
      return {
        url: guesses[index],
        email: emailIn(body, host) ?? homeEmail,
        source: "path",
      };
    }
  }

  return homeEmail ? { url: null, email: homeEmail, source: "site" } : EMPTY;
}

const searchSchema = z.object({
  sites: z
    .array(
      z.object({
        domain: z.string().max(160),
        contactUrl: z.string().max(400).nullable().catch(null),
        contactEmail: z.string().max(200).nullable().catch(null),
      }),
    )
    .max(30),
});

/**
 * La page contact telle qu'un humain la trouverait : la requête « <nom> contact »
 * posée à Gemini, qui est branché sur la recherche Google.
 *
 * Un seul appel pour toute la liste : la recherche coûte plus cher que le reste
 * des appels du tableau de bord, et douze requêtes séparées n'apportent rien de
 * plus qu'une demande groupée.
 */
async function searchContacts(
  sites: { name: string; domain: string }[],
): Promise<Map<string, { url: string | null; email: string | null }>> {
  const out = new Map<string, { url: string | null; email: string | null }>();
  if (sites.length === 0 || !isGeminiConfigured()) return out;

  const grounded = await askGeminiGrounded(searchSchema, {
    label: "Pages contact",
    // La réflexion s'impute sur le budget de sortie : à deux mille tokens sans
    // consigne d'effort, le modèle dépensait tout à réfléchir et rendait une
    // réponse vide. Relever une URL dans des résultats de recherche ne demande
    // pas de jugement — effort court, budget large.
    maxOutputTokens: 6000,
    thinkingLevel: "low",
    prompt: [
      "Avec la recherche Google, trouve la page de contact officielle de chacun des sites listés ci-dessous.",
      "Pour chacun, cherche exactement ce qu'un humain taperait : « <nom du site> contact ».",
      "",
      ...sites.map((site) => `- ${site.name} (${normalizeDomain(site.domain)})`),
      "",
      "Règles :",
      "- contactUrl : l'URL complète et exacte de la page de contact, telle qu'elle existe aujourd'hui.",
      "  Jamais une page d'accueil, jamais une URL reconstruite de mémoire, jamais un lien de résultats",
      "  de recherche. Le contact d'un média hébergé sur le site de son groupe est accepté.",
      "- À défaut de page de contact, une page presse, partenariats ou mentions légales qui donne une adresse.",
      "- contactEmail : l'adresse e-mail publique de contact si elle est écrite sur la page, sinon null.",
      "- Si tu ne trouves pas, mets null. N'invente jamais une URL ni une adresse.",
      "- Reprends le domaine exactement tel qu'il est écrit ci-dessus, pour qu'on reconnaisse la ligne.",
      "",
      "Réponds UNIQUEMENT par un objet JSON de cette forme, sans texte autour :",
      '{ "sites": [{ "domain": "exemple.fr", "contactUrl": "https://…" ou null, "contactEmail": "…" ou null }] }',
    ].join("\n"),
  });

  if (!grounded) return out;
  for (const site of grounded.data.sites) {
    out.set(normalizeDomain(site.domain), {
      url: site.contactUrl?.trim() || null,
      email: site.contactEmail?.trim() || null,
    });
  }
  return out;
}

/** Exécute `task` sur chaque entrée, `limit` en vol à la fois. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * L'adresse de contact de chaque site, cherchée sur le site puis sur Google.
 *
 * La clé de la table rendue est le domaine nu, en minuscules — celui que
 * `bareDomain` produit, pas la chaîne reçue. Les sites sont sondés quatre par
 * quatre : au-delà, une liste de douze domaines lents fait tomber l'action avant
 * d'avoir rendu quoi que ce soit.
 */
export async function findContactPoints(
  sites: { name: string; domain: string }[],
): Promise<Map<string, ContactPoint>> {
  const found = new Map<string, ContactPoint>();
  if (sites.length === 0) return found;

  const probed = await mapLimit(sites, 4, async (site) => {
    try {
      return { site, point: await probeSite(site.domain) };
    } catch {
      // Domaine mort, IP privée, redirection sans fin : le site est perdu pour
      // cette passe, la recherche Google reprendra la main.
      return { site, point: EMPTY };
    }
  });

  for (const { site, point } of probed) found.set(normalizeDomain(site.domain), point);

  const unresolved = probed.filter(({ point }) => !point.url).map(({ site }) => site);
  geoLog("Pages contact — sondage des sites", {
    sites: sites.length,
    trouvées: sites.length - unresolved.length,
  });
  if (unresolved.length === 0) return found;

  const searched = await searchContacts(unresolved);

  await mapLimit(unresolved, 4, async (site) => {
    const key = normalizeDomain(site.domain);
    const hit = searched.get(key);
    if (!hit) return;

    /** Ce qu'on garde quand l'URL ne tient pas : l'adresse, si elle est neuve. */
    const keepEmailOnly = () => {
      if (hit.email && !found.get(key)?.email) {
        found.set(key, { url: null, email: hit.email, source: "search" });
      }
    };

    if (!hit.url) return keepEmailOnly();

    // Le contact d'un média vit souvent chez son groupe — la page contact du
    // Figaro est sur `groupefigaro.com`. On accepte donc un autre domaine, mais
    // seulement après lecture : sur le domaine du site, un chemin qui dit
    // « contact » suffit à retenir une page que le pare-feu nous refuse.
    const sameSite = belongsTo(hit.url, key);
    let email = hit.email;
    let page: PublicPage | null = null;
    try {
      page = await readPage(hit.url);
    } catch {
      page = null;
    }

    const body = bodyOf(page);
    if (body) {
      if (!looksLikeContactPage(body) && !pathSaysContact(hit.url)) return keepEmailOnly();
      email = emailIn(body, key) ?? email;
    } else if (page && !isBotWall(page.status)) {
      // 404 ou 500 : le modèle a rendu une adresse qui n'existe pas. Une page
      // contact morte coûte plus cher au client qu'une case vide.
      geoLog("Pages contact — URL écartée (page absente)", {
        site: key,
        url: hit.url,
        statut: page.status,
      });
      return keepEmailOnly();
    } else if (!sameSite || !pathSaysContact(hit.url)) {
      geoLog("Pages contact — URL écartée (muette, non vérifiable)", { site: key, url: hit.url });
      return keepEmailOnly();
    }

    found.set(key, {
      url: hit.url,
      email: email ?? found.get(key)?.email ?? null,
      source: "search",
    });
  });

  geoLog("Pages contact — après recherche Google", {
    sansContact: [...found.values()].filter((point) => !point.url && !point.email).length,
  });
  return found;
}
