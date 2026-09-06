/**
 * Le prompt de publication d'un article, construit au clic.
 *
 * Tant que le rattachement du site n'est pas ouvert, « publier » ne peut pas
 * déposer l'article : le geste devient donc un prompt que le client colle dans
 * son agent, et qui contient l'article entier, prêt à poser.
 *
 * Rien n'est écrit par un modèle ici, et c'est délibéré. Le tableau de bord ne
 * paie plus qu'une seule rédaction, celle du prompt général de la barre
 * « résoudre » ; et surtout, un article de mille cinq cents mots ne doit jamais
 * traverser un modèle pour être recopié — il abrège, il reformule, et le client
 * colle un texte amputé. Le gabarit ci-dessous porte le Markdown tel quel.
 *
 * Le fichier ne dépend d'aucune API serveur : le navigateur a déjà l'article
 * sous les yeux, il n'y a pas d'aller-retour à payer pour l'assembler.
 */

export type PublishPromptInput = {
  title: string;
  keyword: string | null;
  excerpt: string | null;
  /** Le corps en Markdown, recopié mot pour mot. */
  body: string;
  /** Date de publication prévue, en ISO. */
  scheduledFor: string | null;
  domain: string | null;
  /** Plateforme reconnue sur le site (« WordPress », « Shopify »…). */
  platform: string | null;
};

const OPEN = "----- ARTICLE À PUBLIER (Markdown, ne rien reformuler) -----";
const CLOSE = "----- FIN DE L'ARTICLE -----";

/** « 12 septembre 2026 », ou rien si la date est absente ou illisible. */
function frenchDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Une adresse de page lisible, déduite du titre.
 *
 * Proposée et non imposée : certains sites ont déjà une convention d'URL, et
 * l'agent la verra mieux que nous. Mais sans proposition, il en invente une à
 * chaque fois, et deux articles du même mois se retrouvent avec deux formes.
 */
function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function buildArticlePublishPrompt(input: PublishPromptInput): string {
  const site = input.domain ?? "mon site";
  const date = frenchDate(input.scheduledFor);

  const brief = [
    `- Titre : ${input.title}`,
    input.keyword ? `- Mot-clé visé : ${input.keyword}` : null,
    input.excerpt ? `- Méta description à poser : ${input.excerpt}` : null,
    `- Adresse de page proposée : /blog/${slugify(input.title)}`,
    date ? `- Date de publication prévue : ${date}` : null,
    input.platform ? `- Plateforme du site : ${input.platform}` : null,
  ].filter(Boolean);

  return `Voici un article rédigé pour ${site}. Je veux le publier sur mon blog, tel quel.

${brief.join("\n")}

${OPEN}

${input.body.trim()}

${CLOSE}

Ce que j'attends de toi :
1. Publie l'article ci-dessus sur le blog de ${site}${input.platform ? `, qui tourne sous ${input.platform}` : ""}. Reprends le Markdown mot pour mot : ne réécris rien, ne raccourcis rien, ne change aucun titre de section.
2. Pose le titre en H1 de la page, et garde la hiérarchie H2/H3 du texte telle qu'elle est : c'est elle que les moteurs de réponse lisent pour citer un passage.
3. Renseigne la balise title et la méta description avec les valeurs ci-dessus. S'il en manque une, écris-la à partir du premier paragraphe, sans dépasser 155 caractères.
4. Ajoute un JSON-LD Article sur la page : headline, datePublished, author et publisher au nom du commerce.
5. Relie l'article au reste du site : un lien depuis la page d'accueil ou la page de service la plus proche du sujet, et un lien de retour depuis l'article.
6. Réponds-moi avec l'adresse de l'article publié et la liste de ce que tu as posé, fichier par fichier.`;
}
