import { platformById, type PlatformId } from "@/constants/platforms";
import type { DetectedStack } from "./types";

/**
 * Reconnaissance de la plateforme qui sert le site, à partir de la seule page
 * d'accueil : empreintes publiques du HTML (CDN, balise generator, attributs de
 * l'éditeur) et en-têtes de réponse. Aucune requête supplémentaire.
 *
 * Deux niveaux de certitude :
 * — `sure` : empreinte qui n'appartient qu'à cette plateforme (cdn.shopify.com,
 *   `__NEXT_DATA__`, `data-wf-site`…) ;
 * — `probable` : marqueur crédible mais qu'un thème ou un plugin tiers peut
 *   poser (une simple occurrence du nom de la plateforme, par exemple).
 *
 * L'ordre du tableau fait la priorité, et il n'est pas arbitraire :
 * — les constructeurs de site d'abord (Framer, Webflow, Wix, Squarespace) : ils
 *   génèrent le HTML lui-même, leur empreinte ne peut pas être empruntée ;
 * — les plateformes e-commerce ensuite, parce qu'un script Shopify ou un bouton
 *   d'achat s'embarque sur n'importe quel site sans qu'il soit Shopify ;
 * — la plateforme la plus spécifique avant la plus large (WooCommerce avant
 *   WordPress), et le framework de rendu en dernier (Next.js).
 */

type Marker = { re: RegExp; evidence: string };
type HeaderMarker = { name: string; re?: RegExp; evidence: string };

type StackRule = {
  id: PlatformId;
  headers?: HeaderMarker[];
  sure?: Marker[];
  probable?: Marker[];
};

const RULES: StackRule[] = [
  {
    id: "framer",
    sure: [
      { re: /framerusercontent\.com/i, evidence: "Ressources servies par framerusercontent.com" },
      { re: /content=["'][^"']*Framer/i, evidence: "Balise generator Framer" },
      { re: /data-framer-(name|component)/i, evidence: "Attributs Framer (data-framer)" },
    ],
  },
  {
    id: "webflow",
    sure: [
      { re: /data-wf-(site|page)=/i, evidence: "Attributs Webflow (data-wf-site)" },
      { re: /assets(-global)?\.website-files\.com|uploads-ssl\.webflow\.com|cdn\.prod\.website-files\.com/i, evidence: "CDN Webflow" },
      { re: /content=["'][^"']*Webflow/i, evidence: "Balise generator Webflow" },
    ],
  },
  {
    id: "wix",
    headers: [{ name: "x-wix-request-id", evidence: "En-tête Wix (x-wix-request-id)" }],
    sure: [
      { re: /static\.wixstatic\.com|wixstatic\.com/i, evidence: "Ressources servies par wixstatic.com" },
      { re: /content=["'][^"']*Wix\.com/i, evidence: "Balise generator Wix" },
      { re: /wix-?(warmup-data|first-paint|perf)/i, evidence: "Scripts d'exécution Wix" },
    ],
  },
  {
    id: "squarespace",
    sure: [
      { re: /static1\.squarespace\.com|images\.squarespace-cdn\.com/i, evidence: "CDN Squarespace" },
      { re: /SQUARESPACE_ROLLUPS|Static\.SQUARESPACE_CONTEXT/i, evidence: "Contexte JavaScript Squarespace" },
      { re: /content=["'][^"']*Squarespace/i, evidence: "Balise generator Squarespace" },
    ],
  },
  {
    id: "ghost",
    sure: [
      { re: /content=["'][^"']*Ghost\s*[\d.]*["']/i, evidence: "Balise generator Ghost" },
      { re: /ghost-portal|\/ghost\/api\//i, evidence: "Scripts Ghost (portal / API)" },
    ],
  },
  {
    id: "shopify",
    headers: [
      { name: "x-shopid", evidence: "En-tête Shopify (x-shopid)" },
      { name: "x-shopify-stage", evidence: "En-tête Shopify (x-shopify-stage)" },
    ],
    sure: [
      // Chemin des fichiers d'une boutique : le script de consentement Shopify,
      // lui, s'embarque sur des sites qui ne sont pas des boutiques.
      { re: /cdn\.shopify\.com\/s\/files\//i, evidence: "Fichiers de boutique servis par cdn.shopify.com" },
      { re: /\.myshopify\.com/i, evidence: "Domaine technique myshopify.com" },
      { re: /Shopify\.theme|shopify-section/i, evidence: "Thème Shopify rendu dans la page" },
    ],
  },
  {
    id: "prestashop",
    sure: [
      { re: /var\s+prestashop\s*=|window\.prestashop\s*=/i, evidence: "Objet JavaScript PrestaShop" },
      { re: /content=["'][^"']*PrestaShop/i, evidence: "Balise generator PrestaShop" },
    ],
    probable: [{ re: /prestashop/i, evidence: "Mention PrestaShop dans le code de la page" }],
  },
  {
    id: "woocommerce",
    sure: [
      { re: /wp-content\/plugins\/woocommerce/i, evidence: "Extension WooCommerce chargée" },
      { re: /content=["'][^"']*WooCommerce/i, evidence: "Balise generator WooCommerce" },
    ],
    probable: [{ re: /\bwoocommerce[-_]/i, evidence: "Classes WooCommerce dans le balisage" }],
  },
  {
    id: "wordpress",
    sure: [
      { re: /wp-content\/(themes|uploads|plugins)/i, evidence: "Répertoire wp-content servi par le site" },
      { re: /wp-includes\//i, evidence: "Scripts wp-includes chargés" },
      { re: /content=["'][^"']*WordPress/i, evidence: "Balise generator WordPress" },
    ],
    probable: [{ re: /\/wp-json\/|wp-emoji-release/i, evidence: "API REST WordPress exposée" }],
  },
  {
    id: "nextjs",
    headers: [
      { name: "x-powered-by", re: /next\.js/i, evidence: "En-tête x-powered-by : Next.js" },
      { name: "x-nextjs-cache", evidence: "En-tête de cache Next.js" },
    ],
    sure: [
      { re: /__NEXT_DATA__/i, evidence: "Payload __NEXT_DATA__ dans la page" },
      { re: /\/_next\/(static|image)/i, evidence: "Ressources servies depuis /_next/" },
    ],
  },
];

function fromHeaders(rule: StackRule, headers: Headers): string | null {
  for (const h of rule.headers ?? []) {
    const value = headers.get(h.name);
    if (value == null) continue;
    if (h.re && !h.re.test(value)) continue;
    return h.evidence;
  }
  return null;
}

/**
 * Renvoie la plateforme détectée, ou `null` si le site ne laisse aucune
 * empreinte exploitable (site sur-mesure, HTML entièrement réécrit, cache
 * agressif). Un `null` n'est pas un échec : c'est une information affichée
 * telle quelle dans le rapport.
 */
export function detectStack(
  html: string,
  headers?: Headers | null,
): DetectedStack | null {
  let fallback: DetectedStack | null = null;

  for (const rule of RULES) {
    const meta = platformById(rule.id);
    if (!meta) continue;

    if (headers) {
      const evidence = fromHeaders(rule, headers);
      if (evidence) return { id: rule.id, name: meta.name, confidence: "sure", evidence };
    }

    if (html) {
      const hit = rule.sure?.find((m) => m.re.test(html));
      if (hit) return { id: rule.id, name: meta.name, confidence: "sure", evidence: hit.evidence };

      if (!fallback) {
        const maybe = rule.probable?.find((m) => m.re.test(html));
        if (maybe) {
          fallback = { id: rule.id, name: meta.name, confidence: "probable", evidence: maybe.evidence };
        }
      }
    }
  }

  return fallback;
}
