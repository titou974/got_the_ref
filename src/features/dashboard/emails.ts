import "server-only";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { totalGainFor } from "@/lib/geo/traffic-gain";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import {
  button,
  escapeHtml,
  layout,
  statRow,
  type EmailContent,
} from "@/lib/email-layout";

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
 * Aucun chiffre n'est fabriqué pour remplir le tableau : une ligne dont la
 * donnée manque ne s'affiche pas. Un relevé de trois lignes vraies vaut mieux
 * qu'un relevé de cinq dont deux disent « non disponible ».
 */

/**
 * La place du commerce, dite en une ligne.
 *
 * Le classement sur la niche est celui qui compte — « 3ᵉ sur les boulangeries
 * artisanales du Havre » est une information ; « présent dans ChatGPT » n'en
 * est pas une. Hors du top 10, on le dit franchement : c'est précisément le
 * constat qui justifie le reste de l'e-mail.
 */
function rankLine(analysis: GeoAnalysisResult): { label: string; value: string } | null {
  const niche = analysis.localRankings.find((ranking) => ranking.type === "niche");
  if (!niche) return null;

  return {
    label: "Votre place dans les réponses IA",
    value: niche.targetRank ? `${niche.targetRank}ᵉ sur 10` : "Hors du top 10",
  };
}

export function analysisReadyEmail({
  userName,
  analysis,
}: {
  userName?: string | null;
  analysis: GeoAnalysisResult;
}): EmailContent {
  const hello = userName ? `Bonjour ${escapeHtml(userName)},` : "Bonjour,";
  const url = `${SITE.url}${ROUTES.dashboard}`;
  const score = Math.round(analysis.overallScore);
  const fixes = analysis.recommendations.length;
  const gain = totalGainFor(analysis).total;
  const rank = rankLine(analysis);

  const rows = [
    statRow("Votre note de visibilité IA", `${score} / 100`),
    rank ? statRow(rank.label, rank.value) : "",
    fixes > 0 ? statRow("Correctifs identifiés", String(fixes)) : "",
    statRow("Visites/mois à récupérer", `~ ${gain}`),
  ]
    .filter(Boolean)
    .join("");

  // Le verdict de l'analyse est écrit pour le tableau de bord : il tient en une
  // phrase et dit ce que la note résume en un chiffre. Il n'a pas besoin d'être
  // réécrit pour l'e-mail, et le réécrire ferait deux versions du même constat.
  const verdict = analysis.verdict?.trim();

  const html = layout(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;">
      Votre analyse est prête
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:24px;">${hello}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:24px;">
      Nous avons lu ${escapeHtml(analysis.domain)} page par page, puis posé à
      ChatGPT et à Gemini les questions de vos clients. Voici ce que ça donne.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:1px solid #ececee;">
      ${rows}
    </table>
    ${
      verdict
        ? `<p style="margin:0 0 24px;font-size:15px;line-height:24px;">${escapeHtml(verdict)}</p>`
        : ""
    }
    ${button(url, "Voir mon plan d'action")}
    <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
      Le détail des correctifs, vos concurrents et votre calendrier d'articles
      vous attendent dans le tableau de bord.
    </p>
  `);

  // Une ligne absente vaut `null`, pas la chaîne vide : les chaînes vides sont
  // les sauts de paragraphe, et les filtrer collerait tout le message en bloc.
  const text = [
    userName ? `Bonjour ${userName},` : "Bonjour,",
    "",
    `Nous avons lu ${analysis.domain} page par page, puis posé à ChatGPT et à Gemini les questions de vos clients. Voici ce que ça donne.`,
    "",
    `Votre note de visibilité IA : ${score} / 100`,
    rank ? `${rank.label} : ${rank.value}` : null,
    fixes > 0 ? `Correctifs identifiés : ${fixes}` : null,
    `Visites/mois à récupérer : ~ ${gain}`,
    "",
    verdict ?? null,
    verdict ? "" : null,
    `Voir votre plan d'action : ${url}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject: `Votre visibilité IA : ${score}/100 — ${analysis.domain}`,
    html,
    text,
  };
}
