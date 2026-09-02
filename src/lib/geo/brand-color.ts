import "server-only";

import * as cheerio from "cheerio";
import { fetchPublicText } from "./fetcher";

/**
 * La couleur de la marque, relevée sur son propre site.
 *
 * Ce fichier ne décide de rien : il ramasse les teintes que le site emploie
 * réellement et les classe par vraisemblance. Le choix final revient au modèle
 * (cf. `detectBrandIdentity`), parce qu'une page en propose souvent trois ou
 * quatre — celle du bandeau, celle des boutons, celle d'un pictogramme — et que
 * seule la lecture d'ensemble dit laquelle un visiteur retiendrait.
 *
 * On cherche d'abord là où une marque se déclare : la balise `theme-color`, les
 * variables CSS qui portent son nom (`--primary`, `--brand`, `--accent`), puis
 * le fond des boutons d'appel à l'action. C'est la couleur du bouton « Prendre
 * rendez-vous » qui fait la marque aux yeux du visiteur, pas celle d'un liseré.
 */

/** Une teinte relevée sur le site, avec ce qui la rend crédible. */
export type ColorCandidate = {
  /** La couleur normalisée en hexadécimal à six chiffres, en minuscules. */
  hex: string;
  /** Où elle a été lue — sert au modèle à arbitrer, et à nous à déboguer. */
  source: string;
  /** Le poids accumulé : le nombre de relevés, pondéré par leur qualité. */
  weight: number;
};

/** Nombre de feuilles de style externes réellement téléchargées. */
const MAX_STYLESHEETS = 4;

/** Candidates rendues au modèle. Au-delà, on lui soumet du bruit. */
const MAX_CANDIDATES = 6;

/**
 * Les sélecteurs qui désignent un appel à l'action plutôt qu'un décor.
 *
 * Le mot cherché peut être précédé d'un tiret ou d'un souligné : les thèmes
 * livrés préfixent tout (`elementor-button`, `wp-block-button__link`), et une
 * frontière de mot classique les manquerait tous.
 */
const CTA_SELECTOR =
  /(^|[\s.#[\-_])(btn|button|cta|call-to-action|primary|principal|action|submit|commander|reserver|devis)/i;

/** Les noms de variables CSS où une marque écrit sa couleur. */
const BRAND_VARIABLE =
  /--[\w-]*(primary|primaire|brand|marque|accent|main|principal|cta|theme)[\w-]*/i;

/** Les propriétés qui peignent une surface — pas un texte, pas un liseré. */
const SURFACE_PROPERTY = /^\s*(background|fill)/i;

/** Les teintes que tout site emploie et qui ne disent rien d'une marque. */
const NEUTRAL_HEX = new Set(["000000", "ffffff"]);

/**
 * Ramène une couleur CSS à six chiffres hexadécimaux, ou rend `null`.
 *
 * Trois écritures couvrent ce qu'on rencontre : `#abc`, `#aabbcc` (avec ou sans
 * canal alpha) et `rgb()` / `rgba()`. Les couleurs nommées sont écartées : une
 * marque n'écrit pas `cornflowerblue` dans sa charte, et les rares `red` d'un
 * message d'erreur ne feraient qu'ajouter du bruit.
 *
 * Une couleur presque transparente est rendue `null` : elle ne se voit pas.
 */
export function normalizeCssColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      if (digits.length === 4 && parseInt(digits[3] + digits[3], 16) < 40) return null;
      return digits
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (digits.length === 6) return digits;
    if (digits.length === 8) {
      return parseInt(digits.slice(6), 16) < 40 ? null : digits.slice(0, 6);
    }
    return null;
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/.exec(
    value,
  );
  if (rgb) {
    const alpha = rgb[4];
    if (alpha) {
      const a = alpha.endsWith("%") ? Number(alpha.slice(0, -1)) / 100 : Number(alpha);
      if (Number.isFinite(a) && a < 0.15) return null;
    }
    const channels = [rgb[1], rgb[2], rgb[3]].map((c) => {
      const n = Math.round(Number(c));
      return Number.isFinite(n) ? Math.min(255, Math.max(0, n)) : 0;
    });
    return channels.map((c) => c.toString(16).padStart(2, "0")).join("");
  }

  return null;
}

/**
 * La teinte porte-t-elle une marque, ou est-ce du gris d'interface ?
 *
 * Un site emploie des dizaines de gris — bordures, fonds de carte, texte — et
 * les relever tous noierait la seule couleur qui compte. On écarte donc ce qui
 * est trop pâle, trop sombre ou trop peu saturé pour qu'un visiteur y voie une
 * intention. Le seuil de saturation est bas (12 %) : certaines marques
 * revendiquent un bleu-gris très éteint, et le refuser rendrait `null` sur des
 * sites qui ont pourtant une couleur.
 */
export function isBrandLikeColor(hex: string): boolean {
  if (NEUTRAL_HEX.has(hex)) return false;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (lightness > 0.93 || lightness < 0.06) return false;

  // Deux garde-fous, parce qu'aucun ne suffit seul. L'écart brut entre canaux
  // écarte les gris d'interface, que leur clarté extrême fait passer pour
  // saturés (`#e5e7eb` sort à 13 % de saturation alors que personne n'y voit
  // une couleur). La saturation, elle, écarte les teintes ternes que l'écart
  // brut laisserait passer sur des tons moyens.
  const delta = max - min;
  if (delta < 0.06) return false;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  return saturation >= 0.12;
}

/** Le registre des teintes relevées : une entrée par couleur, poids cumulé. */
type Tally = Map<string, { weight: number; sources: Set<string> }>;

function record(tally: Tally, raw: string, source: string, weight: number): void {
  const hex = normalizeCssColor(raw);
  if (!hex || !isBrandLikeColor(hex)) return;
  const entry = tally.get(hex) ?? { weight: 0, sources: new Set<string>() };
  entry.weight += weight;
  entry.sources.add(source);
  tally.set(hex, entry);
}

/** Toutes les couleurs écrites dans un fragment de déclaration CSS. */
function colorsIn(text: string): string[] {
  return [
    ...(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(text.match(/rgba?\([^)]*\)/g) ?? []),
  ];
}

/**
 * Dépouille une feuille de style.
 *
 * L'expression rationnelle ne retient que les blocs sans accolade imbriquée :
 * dans `@media … { .btn { … } }`, elle tombe donc sur `.btn { … }` et laisse
 * l'enveloppe de côté, ce qui est exactement ce qu'on veut. Un vrai analyseur
 * CSS rendrait la même chose ici pour un mégaoctet de dépendance.
 */
function scanStylesheet(css: string, tally: Tally, origin: string): void {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Les variables de marque, où qu'elles soient déclarées : c'est la charte
  // écrite noir sur blanc, elle passe avant tout relevé de bouton.
  const variables = clean.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g);
  for (const [, name, value] of variables) {
    if (!BRAND_VARIABLE.test(name)) continue;
    for (const color of colorsIn(value)) record(tally, color, `${origin} ${name}`, 4);
  }

  for (const [, selector, body] of clean.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!CTA_SELECTOR.test(selector)) continue;
    for (const declaration of body.split(";")) {
      if (!SURFACE_PROPERTY.test(declaration)) continue;
      for (const color of colorsIn(declaration)) {
        record(tally, color, `${origin} bouton`, 3);
      }
    }
  }
}

/** Les feuilles de style de même origine appelées par la page, en clair. */
async function fetchStylesheets($: cheerio.CheerioAPI, homeUrl: string): Promise<string[]> {
  const home = new URL(homeUrl);
  const hrefs: string[] = [];

  $('link[rel~="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, home);
      if (url.origin !== home.origin) return;
      hrefs.push(url.toString());
    } catch {
      /* href illisible : ignoré */
    }
  });

  const sheets = await Promise.all(
    hrefs.slice(0, MAX_STYLESHEETS).map((href) => fetchPublicText(href).catch(() => null)),
  );
  return sheets.filter((sheet): sheet is string => Boolean(sheet));
}

/**
 * Les couleurs candidates d'un site, de la plus crédible à la moins.
 *
 * Best-effort de bout en bout : un site injoignable, une feuille de style
 * absente ou un thème qui ne déclare rien rendent une liste vide, et l'appelant
 * s'en passe. Aucune exception ne remonte — la couleur est un bonus dans
 * l'analyse, elle ne doit jamais la faire échouer.
 */
export async function collectBrandColors(homeUrl: string): Promise<ColorCandidate[]> {
  const tally: Tally = new Map();

  let html: string | null = null;
  try {
    html = await fetchPublicText(homeUrl, 1_500_000);
  } catch {
    return [];
  }
  if (!html) return [];

  const $ = cheerio.load(html);

  // La déclaration la plus explicite qu'un site puisse faire : c'est la couleur
  // dont il peint la barre du navigateur mobile.
  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) record(tally, themeColor, "balise theme-color", 5);

  // Les fonds posés à même la balise sur un bouton : rares, mais sans ambiguïté.
  $("a, button, input[type=submit]").each((_, el) => {
    const node = $(el);
    const classes = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
    if (!CTA_SELECTOR.test(` ${classes}`)) return;

    const style = node.attr("style") ?? "";
    for (const declaration of style.split(";")) {
      if (!SURFACE_PROPERTY.test(declaration)) continue;
      for (const color of colorsIn(declaration)) record(tally, color, "bouton (style en ligne)", 3);
    }

    // Tailwind écrit ses valeurs arbitraires dans la classe elle-même.
    for (const [, color] of classes.matchAll(/bg-\[(#[0-9a-fA-F]{3,8})\]/g)) {
      record(tally, color, "bouton (classe Tailwind)", 3);
    }
  });

  const inlineStyles = $("style")
    .map((_, el) => $(el).text())
    .get()
    .join("\n");
  if (inlineStyles) scanStylesheet(inlineStyles, tally, "style en ligne");

  try {
    for (const sheet of await fetchStylesheets($, homeUrl)) {
      scanStylesheet(sheet, tally, "feuille de style");
    }
  } catch {
    /* feuilles inaccessibles : on se contente de ce qui a été lu */
  }

  return [...tally.entries()]
    .map(([hex, entry]) => ({
      hex: `#${hex}`,
      source: [...entry.sources].join(", "),
      weight: entry.weight,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CANDIDATES);
}
