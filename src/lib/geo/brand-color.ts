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
 * Le relevé passe par le chemin que suit un navigateur, faute de quoi il rate
 * la plupart des sites : on repère les boutons d'appel à l'action dans le HTML,
 * on lit leurs classes, et on va chercher le fond que le CSS pose sur ces
 * classes-là. Une première version cherchait le mot « bouton » dans le NOM des
 * sélecteurs ; elle ne voyait rien sur un site Tailwind, où le bouton porte
 * `bg-indigo-600` et où la règle s'appelle `.bg-indigo-600`. C'est l'association
 * entre l'élément et la règle qui porte l'information, pas le vocabulaire de
 * l'une ou de l'autre.
 *
 * Trois autres sources complètent, dans l'ordre où on leur fait confiance : les
 * variables CSS qui portent le nom de la charte (`--primary`, `--brand`), la
 * couleur déclarée pour l'épingle Safari et la barre du navigateur mobile, et
 * enfin les sélecteurs qui se nomment eux-mêmes « bouton ».
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

/** Nombre de feuilles de style réellement téléchargées. */
const MAX_STYLESHEETS = 6;

/** Ce qu'on lit d'une feuille de style. Un thème Shopify pèse plusieurs mégas. */
const STYLESHEET_CHARS = 500_000;

/** Ce qu'on lit de la page d'accueil elle-même. */
const HTML_CHARS = 1_500_000;

/** Éléments d'appel à l'action examinés. Au-delà, c'est un menu, pas des CTA. */
const MAX_CTA_ELEMENTS = 60;

/** Candidates rendues au modèle. Au-delà, on lui soumet du bruit. */
const MAX_CANDIDATES = 6;

/**
 * Ce que vaut un bouton dont la classe mène à une couleur, et jusqu'où l'on
 * suit une classe ambiguë.
 *
 * Le poids se divise par le nombre de couleurs que la classe porte dans tout le
 * CSS. Une classe qui n'en porte qu'une la désigne, et vaut plein tarif ; une
 * classe que le thème repeint dans huit contextes ne désigne rien, et la
 * créditer huit fois à plein mettait quatre couleurs à égalité en tête chez un
 * constructeur automobile dont la marque n'en a qu'une.
 */
const TOKEN_WEIGHT = 5;

/**
 * Au-delà, la classe est un fourre-tout du thème : on ne la suit plus.
 *
 * Le seuil est haut à dessein. Un thème d'industriel repeint sa classe de
 * bouton dans une dizaine de contextes, et couper à six revenait à ne plus rien
 * tirer de ses boutons — donc à laisser sa charte départager seule, à égalité
 * parfaite. Mieux vaut un signal dilué qu'aucun signal.
 */
const MAX_TOKEN_COLORS = 12;

/**
 * Les mots qui, dans une classe ou un sélecteur, annoncent un appel à l'action.
 *
 * Le mot peut être précédé d'un tiret ou d'un souligné : les thèmes livrés
 * préfixent tout (`elementor-button`, `wp-block-button__link`), et une frontière
 * de mot classique les manquerait tous.
 */
const CTA_WORD =
  /(^|[\s.#[\-_])(btn|button|bouton|cta|call-to-action|primary|principal|submit|commander|reserver|devis|acheter|panier|checkout)/i;

/**
 * Ce qu'un bouton d'appel à l'action dit, sur un site français.
 *
 * Le second filet, pour les sites dont les classes ne nomment rien
 * (`.c-lk--1`, les classes hachées d'un constructeur visuel). Le texte, lui,
 * reste écrit pour un humain : c'est le repère le plus stable qui existe.
 */
const CTA_TEXT =
  /(contact|devis|réserv|reserv|rendez-vous|commander|acheter|panier|inscri|essai|essayer|découvrir|decouvrir|en savoir plus|nous appeler|appelez|obtenir|télécharger|telecharger|demander)/i;

/** Les noms de variables CSS où une marque écrit sa couleur. */
const BRAND_VARIABLE =
  /^--[\w-]*(primary|primaire|brand|marque|accent|main|principal|cta|bouton|button)[\w-]*$/i;

/** Les propriétés qui peignent une surface — pas un texte, pas un liseré. */
const SURFACE_PROPERTY = /^\s*(background|fill)/i;

/**
 * Les états qui ne donnent pas la couleur de repos.
 *
 * Un `:hover` porte une variante assombrie de la même teinte. La retenir ne
 * ferait que couper le compte en deux entre deux nuances du même bleu.
 */
const STATE_PSEUDO = /:(hover|focus|active|visited|focus-within|focus-visible|disabled)/i;

/** Feuilles de style qui ne disent rien d'une marque : polices et pictogrammes. */
const NOT_A_THEME = /(fonts?\.googleapis|fonts?\.gstatic|font-?awesome|typekit|iconfont|\bicons?\.css)/i;

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

// ── Le CSS, réduit à ce qui peint un fond ────────────────────────────────────

/**
 * Le CSS du site, indexé comme un navigateur l'interrogerait.
 *
 * `byToken` est le cœur : une classe ou un identifiant, et les fonds que le CSS
 * pose dessus. C'est ce qui permet de partir d'un bouton trouvé dans le HTML et
 * d'arriver à sa couleur, quel que soit le nom que le thème a donné à sa classe.
 */
type CssIndex = {
  /**
   * `btn-primary` ou `#devis` → les couleurs de fond posées sur ce jeton.
   *
   * Plusieurs par jeton, forcément : un thème redéfinit `.button` dans vingt
   * contextes. C'est justement ce que dit le nombre — un jeton qui porte une
   * seule couleur la désigne, un jeton qui en porte huit ne désigne rien. Le
   * relevé pondère en conséquence (cf. `TOKEN_WEIGHT`).
   */
  byToken: Map<string, Set<string>>;
  /** Les fonds posés par un sélecteur qui se nomme lui-même « bouton ». */
  namedCta: Set<string>;
  /** Les couleurs déclarées dans une variable de charte. */
  brandVars: Set<string>;
  /** Toutes les variables CSS, pour résoudre les `var(--x)`. */
  vars: Map<string, string>;
};

const emptyIndex = (): CssIndex => ({
  byToken: new Map(),
  namedCta: new Set(),
  brandVars: new Set(),
  vars: new Map(),
});

/**
 * Remplace les `var(--x)` d'une valeur par ce que la variable contient.
 *
 * Trois passes suffisent : une charte renvoie parfois `--btn-bg` vers
 * `--color-primary`, qui renvoie vers `--brand`, mais jamais plus loin. Au-delà,
 * on rend la valeur telle quelle plutôt que de boucler sur une définition
 * circulaire.
 */
function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth >= 3 || !value.includes("var(")) return value;

  const resolved = value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g, (_, name, fallback) => {
    const found = vars.get(String(name).toLowerCase());
    return found ?? (fallback ? String(fallback) : "");
  });

  return resolved === value ? value : resolveVars(resolved, vars, depth + 1);
}

/** Toutes les couleurs écrites dans un fragment de déclaration CSS. */
function colorsIn(text: string): string[] {
  return [
    ...(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(text.match(/rgba?\([^)]*\)/g) ?? []),
  ];
}

/**
 * Le sujet d'un sélecteur : le dernier maillon, celui que la règle peint.
 *
 * Dans `.card .btn-primary`, c'est `.btn-primary` qui reçoit le fond ; indexer
 * aussi `.card` ferait passer la couleur du bouton pour celle de la carte, et
 * un élément portant `card` la réclamerait à tort.
 */
function subjectTokens(selector: string): string[] {
  const parts = selector.split(/[\s>+~]+/).filter(Boolean);
  const subject = parts[parts.length - 1] ?? "";
  return [
    ...[...subject.matchAll(/\.([\w-]+)/g)].map((m) => m[1].toLowerCase()),
    ...[...subject.matchAll(/#([\w-]+)/g)].map((m) => m[1].toLowerCase()),
  ];
}

/** Retire les commentaires : ils contiennent des couleurs mortes. */
const uncomment = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Première passe : toutes les variables de toutes les feuilles.
 *
 * Elle précède la lecture des règles, et sur l'ensemble des feuilles à la fois.
 * Une charte se déclare volontiers en fin de fichier, après les règles qui s'en
 * servent — et sur un site à plusieurs feuilles, dans un autre fichier que
 * celles-ci. Résoudre les `var()` au fil de l'eau laissait donc sans réponse
 * les règles lues trop tôt.
 */
function collectVars(css: string, index: CssIndex): void {
  for (const [, name, value] of uncomment(css).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    index.vars.set(name.toLowerCase(), value.trim());
  }
}

/** Les couleurs déclarées par une variable qui porte le nom de la charte. */
function collectBrandVars(index: CssIndex): void {
  for (const [name, value] of index.vars) {
    if (!BRAND_VARIABLE.test(name)) continue;
    for (const color of colorsIn(resolveVars(value, index.vars))) index.brandVars.add(color);
  }
}

/**
 * Seconde passe : les règles, et le fond qu'elles posent.
 *
 * L'expression rationnelle ne retient que les blocs sans accolade imbriquée :
 * dans `@media … { .btn { … } }`, elle tombe donc sur `.btn { … }` et laisse
 * l'enveloppe de côté, ce qui est exactement ce qu'on veut. Un vrai analyseur
 * CSS rendrait la même chose ici pour un mégaoctet de dépendance.
 */
function scanRules(css: string, index: CssIndex): void {
  const clean = uncomment(css);

  for (const [, rawSelector, body] of clean.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = rawSelector.trim();
    if (!selector || selector.startsWith("@")) continue;

    const colors: string[] = [];
    for (const declaration of body.split(";")) {
      if (!SURFACE_PROPERTY.test(declaration)) continue;
      const value = declaration.slice(declaration.indexOf(":") + 1);
      colors.push(...colorsIn(resolveVars(value, index.vars)));
    }
    if (colors.length === 0) continue;

    for (const part of selector.split(",")) {
      const one = part.trim();
      if (!one || STATE_PSEUDO.test(one)) continue;

      if (CTA_WORD.test(one)) for (const color of colors) index.namedCta.add(color);

      for (const token of subjectTokens(one)) {
        const bucket = index.byToken.get(token) ?? new Set<string>();
        for (const color of colors) bucket.add(color);
        index.byToken.set(token, bucket);
      }
    }
  }
}

/**
 * Les feuilles de style appelées par la page.
 *
 * Toutes origines confondues, et c'est délibéré : Shopify, Wix et Squarespace
 * servent la leur depuis un CDN, et s'en tenir à l'origine du site revenait à
 * ne rien lire chez eux. Le garde-fou anti-SSRF de `fetchPublicText` s'applique
 * de toute façon à chaque adresse. Seules les polices et bibliothèques de
 * pictogrammes sont écartées : elles ne portent aucune couleur de marque et
 * consommeraient le budget de lecture.
 *
 * Deux formes s'ajoutent au `rel="stylesheet"` d'école. Le préchargement
 * (`rel="preload" as="style"`), que les thèmes soucieux de leur vitesse
 * emploient à sa place, en rattachant la feuille par un script au chargement.
 * Et l'`@import`, dont WordPress reste friand : la feuille déclarée dans le
 * HTML n'y contient que la ligne qui en appelle une autre, et s'arrêter à elle
 * revenait à lire une table des matières pour un livre.
 */
async function fetchStylesheets($: cheerio.CheerioAPI, homeUrl: string): Promise<string[]> {
  const home = new URL(homeUrl);
  const queued: string[] = [];

  const enqueue = (href: string | undefined, base: string): void => {
    if (!href || NOT_A_THEME.test(href)) return;
    try {
      const url = new URL(href, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const absolute = url.toString();
      if (!queued.includes(absolute)) queued.push(absolute);
    } catch {
      /* href illisible : ignoré */
    }
  };

  $('link[rel~="stylesheet"][href], link[rel~="preload"][as="style"][href]').each((_, el) => {
    enqueue($(el).attr("href"), home.toString());
  });

  // Une seule file, dépilée dans l'ordre : les `@import` rencontrés s'y ajoutent
  // et concourent au même budget que les feuilles du HTML. Sans ce plafond
  // commun, un thème qui importe vingt fichiers ferait vingt requêtes pendant
  // que le client attend son analyse.
  const sheets: string[] = [];
  for (let i = 0; i < queued.length && sheets.length < MAX_STYLESHEETS; i++) {
    const href = queued[i];
    const css = await fetchPublicText(href, STYLESHEET_CHARS).catch(() => null);
    if (!css) continue;
    sheets.push(css);

    for (const [, imported] of css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)) {
      enqueue(imported, href);
    }
  }

  return sheets;
}

// ── Le relevé ────────────────────────────────────────────────────────────────

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
    html = await fetchPublicText(homeUrl, HTML_CHARS);
  } catch {
    return [];
  }
  if (!html) return [];

  const $ = cheerio.load(html);

  const index = emptyIndex();
  const sources: string[] = [
    $("style")
      .map((_, el) => $(el).text())
      .get()
      .join("\n"),
  ];
  try {
    sources.push(...(await fetchStylesheets($, homeUrl)));
  } catch {
    /* feuilles inaccessibles : on se contente de ce qui a été lu */
  }

  for (const css of sources) if (css) collectVars(css, index);
  collectBrandVars(index);
  for (const css of sources) if (css) scanRules(css, index);

  // 1. Les boutons de la page, et le fond que le CSS leur donne. C'est la
  //    source qui compte : c'est ce qu'un visiteur voit réellement.
  let seen = 0;
  $("a, button, input[type=submit], [role=button]").each((_, el) => {
    if (seen >= MAX_CTA_ELEMENTS) return false;

    const node = $(el);
    const classAttr = node.attr("class") ?? "";
    const idAttr = node.attr("id") ?? "";
    const label = node.text().trim().slice(0, 60);

    const looksLikeCta =
      CTA_WORD.test(` ${classAttr} ${idAttr}`) || (label.length > 2 && CTA_TEXT.test(label));
    if (!looksLikeCta) return;
    seen += 1;

    // Une couleur par élément, au meilleur poids qu'elle y obtient : un bouton
    // dont deux classes portent le même fond ne vaut pas deux relevés.
    const found = new Map<string, number>();
    const keep = (color: string, weight: number): void => {
      found.set(color, Math.max(found.get(color) ?? 0, weight));
    };

    const tokens = [
      ...classAttr.split(/\s+/).filter(Boolean),
      ...(idAttr ? [idAttr] : []),
    ].map((token) => token.toLowerCase());
    for (const token of tokens) {
      const colors = index.byToken.get(token);
      if (!colors || colors.size > MAX_TOKEN_COLORS) continue;
      for (const color of colors) keep(color, TOKEN_WEIGHT / colors.size);
    }

    // Tailwind écrit ses valeurs arbitraires dans la classe elle-même : aucune
    // règle CSS à retrouver, la couleur est sous nos yeux, sans ambiguïté.
    for (const [, color] of classAttr.matchAll(/bg-\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\))\]/g)) {
      keep(color, TOKEN_WEIGHT);
    }

    for (const declaration of (node.attr("style") ?? "").split(";")) {
      if (!SURFACE_PROPERTY.test(declaration)) continue;
      for (const color of colorsIn(resolveVars(declaration, index.vars))) keep(color, TOKEN_WEIGHT);
    }

    for (const [color, weight] of found) record(tally, color, "fond d'un bouton de la page", weight);
  });

  // 2. La charte déclarée en toutes lettres dans les variables CSS.
  for (const color of index.brandVars) record(tally, color, "variable de charte", 4);

  // 3. L'épingle Safari et la barre du navigateur mobile : deux endroits où un
  //    site écrit sa couleur sans qu'aucune mise en page ne s'y interpose.
  const maskIcon = $('link[rel~="mask-icon"][color]').attr("color");
  if (maskIcon) record(tally, maskIcon, "épingle Safari", 4);
  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) record(tally, themeColor, "balise theme-color", 3);

  // 4. En dernier, les sélecteurs qui se nomment eux-mêmes « bouton ». Le thème
  //    peut les définir sans qu'aucun élément de la page d'accueil les porte.
  for (const color of index.namedCta) record(tally, color, "sélecteur de bouton", 2);

  return [...tally.entries()]
    .map(([hex, entry]) => ({
      hex: `#${hex}`,
      source: [...entry.sources].join(", "),
      // Arrondi au dixième : le poids est soumis au modèle, et une fraction à
      // quinze décimales ne l'aiderait pas à trancher.
      weight: Math.round(entry.weight * 10) / 10,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CANDIDATES);
}
