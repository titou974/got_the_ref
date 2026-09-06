import "server-only";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { totalGainFor } from "@/lib/geo/traffic-gain";
import type { GeoAnalysisResult, Recommendation } from "@/lib/geo/types";
import { escapeHtml, type EmailContent } from "@/lib/email-layout";

/**
 * L'e-mail envoyé quand l'audit d'entrée est terminé.
 *
 * L'analyse dure une à trois minutes. C'est court quand on la regarde tourner,
 * c'est long quand on a fermé l'onglet — et beaucoup le ferment. Sans cet
 * e-mail, le client qui s'inscrit à midi et déjeune ne revient jamais voir ce
 * qu'il a demandé.
 *
 * Il porte les chiffres, pas une invitation à venir les chercher. Une note, une
 * place, un nombre de correctifs, une estimation de trafic : de quoi savoir en
 * dix secondes si la nouvelle est bonne ou mauvaise, et cliquer pour la raison
 * qu'on a déjà. Un e-mail qui dirait seulement « votre analyse est prête »
 * ferait le trajet pour rien.
 *
 * Aucun chiffre n'est fabriqué pour remplir la carte : une tuile dont la donnée
 * manque ne s'affiche pas, et la liste des correctifs s'arrête à ce qu'on a
 * relevé. Quatre lignes vraies valent mieux que quatre lignes dont deux disent
 * « non disponible ».
 *
 * ## Sa mise en page
 *
 * Comme la bienvenue, c'est une carte dessinée dans Resend et reprise telle
 * quelle : quatre tuiles de chiffres, le constat en clair, l'aperçu des
 * correctifs, le bouton. Elle ne passe donc pas par l'enveloppe commune
 * (`@/lib/email-layout`) — la faire rentrer dedans reviendrait à la
 * redessiner.
 */

/** Le logotype des cartes Resend, servi par leur CDN. */
const LOGO_URL = "https://resend-attachments.s3.amazonaws.com/0e0be545-c3cb-447a-ae11-f40fe5b82d31";

/** Police de la carte, recopiée telle quelle sur chaque bloc de texte. */
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

/**
 * La place du commerce, dite en une ligne.
 *
 * Le classement sur la niche est celui qui compte — « 3ᵉ sur les boulangeries
 * artisanales du Havre » est une information ; « présent dans ChatGPT » n'en
 * est pas une. Hors du top 10, on le dit franchement : c'est précisément le
 * constat qui justifie le reste de l'e-mail.
 *
 * `value` porte le chiffre, `unit` le « / 10 » gris qui le suit. Les deux sont
 * séparés parce que « hors du top 10 » n'a pas d'unité à traîner derrière lui.
 */
function rankLine(analysis: GeoAnalysisResult): { value: string; unit: string } | null {
  const niche = analysis.localRankings.find((ranking) => ranking.type === "niche");
  if (!niche) return null;

  return niche.targetRank
    ? { value: String(niche.targetRank), unit: " / 10" }
    : { value: "Hors du top 10", unit: "" };
}

/** L'ordre d'urgence des correctifs : l'aperçu montre les plus pressants. */
const PRIORITY_RANK: Record<Recommendation["priority"], number> = {
  critique: 0,
  haute: 1,
  moyenne: 2,
  basse: 3,
};

/** Une tuile de chiffre : l'intitulé au-dessus, la valeur en gros dessous. */
function statTile(label: string, value: string, unit = ""): string {
  return `<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="box-sizing:border-box;background-color:#ffffff;border-radius:16px;font-family:${FONT_STACK};">
      <tbody><tr><td style="padding:18px;">
        <p style="margin:0 0 6px;font-size:12px;color:#71717a;">${escapeHtml(label)}</p>
        <p style="margin:0;font-size:32px;color:#09090b;font-weight:700;line-height:1.1;">${escapeHtml(value)}${
          unit ? `<span style="color:#a1a1aa">${escapeHtml(unit)}</span>` : ""
        }</p>
      </td></tr></tbody>
    </table>`;
}

/** Une paire de tuiles sur une ligne, la seconde pouvant manquer. */
function statRow(left: string, right: string, top: boolean): string {
  const pad = top ? "padding-bottom:12px;" : "padding-top:4px;";
  return `<table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
      <tbody><tr>
        <td style="padding-right:8px;${pad}vertical-align:top;width:50%;">${left}</td>
        <td style="padding-left:8px;${pad}vertical-align:top;width:50%;">${right}</td>
      </tr></tbody>
    </table>`;
}

export function analysisReadyEmail({
  userName,
  analysis,
}: {
  userName?: string | null;
  analysis: GeoAnalysisResult;
}): EmailContent {
  const url = `${SITE.url}${ROUTES.dashboard}`;
  const score = Math.round(analysis.overallScore);
  const fixes = analysis.recommendations.length;
  const gain = totalGainFor(analysis).total;
  const rank = rankLine(analysis);
  const domain = analysis.domain;

  // Le prénom seul : la carte s'adresse à une personne, pas à un identifiant.
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const hello = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";

  // Le verdict de l'analyse est écrit pour le tableau de bord : il tient en une
  // phrase et dit ce que la note résume en un chiffre. Il n'a pas besoin d'être
  // réécrit pour l'e-mail, et le réécrire ferait deux versions du même constat.
  const verdict = analysis.verdict?.trim();

  // Les quatre correctifs les plus urgents, dans l'ordre où on les traiterait.
  const preview = [...analysis.recommendations]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 4)
    .map((recommendation) => recommendation.title);

  const tiles = [
    statRow(
      statTile("Note de visibilité IA", String(score), " / 100"),
      rank ? statTile("Place dans les réponses", rank.value, rank.unit) : "",
      true,
    ),
    statRow(
      fixes > 0 ? statTile("Correctifs identifiés", String(fixes)) : "",
      statTile("Visites/mois à récupérer", `~ ${gain}`),
      false,
    ),
  ].join("");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="fr"><head><meta content="width=device-width" name="viewport"/><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/><meta content="IE=edge" http-equiv="X-UA-Compatible"/><meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/><title>Découvrez votre score de visibilité IA et les actions à entreprendre.</title><style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style></head><body dir="ltr" lang="fr" style="background-color:#f4f4f5;padding-top:0;padding-bottom:0"><div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">Découvrez votre score de visibilité IA et les actions à entreprendre.</div><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td dir="ltr" lang="fr" style="font-family:${FONT_STACK};font-size:1em;min-height:100%;line-height:155%;background-color:#f4f4f5;padding-top:32px;padding-bottom:32px;color:#18181b"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:36px;line-height:155%"><tbody><tr style="width:100%"><td style="padding-top:40px;padding-right:40px;padding-bottom:40px;padding-left:40px"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"><tbody style="width:100%"><tr style="width:100%"><td align="center"><img alt="${escapeHtml(SITE.name)}" src="${LOGO_URL}" style="display:block;outline:none;border:none;text-decoration:none;height:auto;margin-bottom:24px" width="64"/></td></tr></tbody></table><h1 style="margin:0 0 16px;font-size:32px;line-height:1.15;font-weight:700;color:#09090b">Votre analyse est prête</h1><p style="margin:0 0 8px;font-size:15px;color:#52525b">${hello}</p><p style="margin:12px 0 24px;font-size:15px;color:#52525b">Nous avons lu ${escapeHtml(domain)} page par page, puis posé à ChatGPT, Gemini, Perplexity et Claude les questions de vos clients. Voici ce que ça donne.</p><table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="box-sizing:border-box;background-color:#f4f4f5;border-radius:28px;margin-top:8px;margin-bottom:8px"><tbody><tr><td style="padding:28px">${tiles}</td></tr></tbody></table>${
    verdict
      ? `<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="box-sizing:border-box;background-color:#ececee;border-radius:24px;margin-top:24px;margin-bottom:32px"><tbody><tr><td style="padding:24px"><p style="margin:0 0 8px;font-size:12px;color:#71717a">CE QU'IL FAUT RETENIR</p><p style="margin:0;font-size:15px;color:#18181b">${escapeHtml(verdict)}</p></td></tr></tbody></table>`
      : `<div style="height:24px"></div>`
  }${
    preview.length > 0
      ? `<h3 style="margin:0 0 12px;font-size:18px;line-height:1.08em;font-weight:700;color:#09090b">Aperçu des correctifs</h3><ul style="margin:0;padding:0 0 1em 1.1em">${preview
          .map(
            (title) =>
              `<li style="margin:0 0 0 1em;padding:0.3em 0"><p style="margin:0;color:#3f3f46;font-size:14px">${escapeHtml(title)}</p></li>`,
          )
          .join("")}</ul>`
      : ""
  }<table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"><tbody style="width:100%"><tr style="width:100%"><td align="center"><a href="${url}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px;box-sizing:border-box;padding:14px 28px;background-color:#09090b;color:#ffffff;border-radius:10000px;font-weight:600;font-size:0.875em;text-align:center;margin-top:28px;margin-bottom:8px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:10.5px">Découvrir l'analyse complète</span></a></td></tr></tbody></table><p style="margin:12px 0 0;font-size:12px;color:#71717a;text-align:center">Un doute sur un correctif ? Répondez simplement à cet email.</p><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="font-size:0.8em"><tbody><tr><td style="padding-top:32px"><hr style="width:100%;border:none;border-top:2px solid #e4e4e7;margin-top:8px;margin-bottom:20px"/><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"><tbody style="width:100%"><tr style="width:100%"><td align="center"><img alt="${escapeHtml(SITE.name)}" src="${LOGO_URL}" style="display:block;outline:none;border:none;text-decoration:none;height:auto;margin-bottom:12px" width="40"/></td></tr></tbody></table><p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center">© ${new Date().getFullYear()} ${escapeHtml(SITE.name)} — Analyse de référencement IA</p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></body></html>`;

  // Une ligne absente vaut `null`, pas la chaîne vide : les chaînes vides sont
  // les sauts de paragraphe, et les filtrer collerait tout le message en bloc.
  const text = [
    firstName ? `Bonjour ${firstName},` : "Bonjour,",
    "",
    `Nous avons lu ${domain} page par page, puis posé à ChatGPT, Gemini, Perplexity et Claude les questions de vos clients. Voici ce que ça donne.`,
    "",
    `Note de visibilité IA : ${score} / 100`,
    rank ? `Place dans les réponses : ${rank.value}${rank.unit}` : null,
    fixes > 0 ? `Correctifs identifiés : ${fixes}` : null,
    `Visites/mois à récupérer : ~ ${gain}`,
    "",
    verdict ?? null,
    verdict ? "" : null,
    preview.length > 0 ? "Aperçu des correctifs :" : null,
    ...preview.map((title) => `— ${title}`),
    preview.length > 0 ? "" : null,
    `Découvrir l'analyse complète : ${url}`,
    "",
    "Un doute sur un correctif ? Répondez simplement à cet email.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject: `Votre visibilité IA : ${score}/100 — ${domain}`,
    html,
    text,
  };
}
