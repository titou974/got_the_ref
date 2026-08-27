import { parseBlocks } from "./markdown-blocks";

/**
 * Le corps d'un article, du Markdown vers le HTML que les CMS attendent.
 *
 * Les articles sont stockés en Markdown : c'est ce que l'atelier édite et ce
 * que le prompt de correction recopie. Mais ni WordPress ni Shopify ne le
 * lisent — l'un attend du HTML dans `content`, l'autre dans `body_html`, et un
 * article déposé en Markdown s'affiche avec ses dièses et ses astérisques en
 * plein milieu de la page du client.
 *
 * La conversion s'appuie sur le découpage en blocs déjà écrit pour l'atelier
 * (`markdown-blocks`) : titres, listes, citations et blocs de code y sont déjà
 * reconnus, et un seul endroit décide de ce qu'est un paragraphe. Ne reste que
 * l'inline — gras, italique, liens, code — et l'échappement.
 *
 * Aucune dépendance ajoutée : le Markdown produit par la rédaction est celui
 * que ce projet écrit lui-même, pas du Markdown arbitraire venu d'ailleurs.
 * Une bibliothèque complète (tableaux, HTML brut, notes de bas de page) n'aurait
 * rien à convertir de plus, et il faudrait la maintenir.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ESCAPES[char]);
}

/**
 * Une URL de lien acceptable dans le corps publié.
 *
 * Le texte vient d'un modèle, et il finit dans le site d'un client : on ne
 * laisse passer que http, https et mailto. Un `javascript:` recopié depuis une
 * source empoisonnée n'a rien à faire dans un article de blog.
 */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(url) ? url : null;
}

/**
 * Le balisage de fin de ligne : gras, italique, code, liens.
 *
 * L'échappement passe en premier, la mise en forme ensuite : l'inverse
 * transformerait nos propres balises en `&lt;strong&gt;`.
 */
function inline(text: string): string {
  let html = escapeHtml(text);

  // Le code d'abord : ce qu'il contient ne doit plus être interprété. La
  // marque est bornée par un caractère nul, qu'aucun Markdown ne peut
  // écrire : un numéro entre espaces se confondrait avec le texte.
  const codes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const url = safeHref(href);
    return url ? `<a href="${escapeHtml(url)}">${label}</a>` : label;
  });

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Le caractère qui précède ne doit pas être une lettre — sinon `snake_case`
  // deviendrait de l'italique — mais il peut être une apostrophe : « de
  // l'*italique* » est la forme la plus courante en français.
  html = html.replace(/(^|[^\w*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^\w_])_([^_\n]+)_/g, "$1<em>$2</em>");

  return html.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)]);
}

const listItems = (text: string, tag: "ul" | "ol") =>
  `<${tag}>${text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<li>${inline(line.trim())}</li>`)
    .join("")}</${tag}>`;

export function markdownToHtml(markdown: string): string {
  return parseBlocks(markdown)
    .map((block) => {
      switch (block.kind) {
        case "h2":
          return `<h2>${inline(block.text)}</h2>`;
        case "h3":
          return `<h3>${inline(block.text)}</h3>`;
        case "ul":
          return listItems(block.text, "ul");
        case "ol":
          return listItems(block.text, "ol");
        case "quote":
          return `<blockquote><p>${inline(block.text)}</p></blockquote>`;
        case "code":
          return `<pre><code${
            block.lang ? ` class="language-${escapeHtml(block.lang)}"` : ""
          }>${escapeHtml(block.text)}</code></pre>`;
        default:
          return `<p>${inline(block.text)}</p>`;
      }
    })
    .join("\n");
}
