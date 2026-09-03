import "server-only";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { button, escapeHtml, layout, type EmailContent } from "@/lib/email-layout";

/**
 * L'e-mail de confirmation de l'analyse gratuite lancée depuis la page
 * d'accueil.
 *
 * Il part au moment où le compte s'ouvre, c'est-à-dire pendant que l'analyse
 * tourne encore sous les yeux du visiteur. Il ne raconte donc pas de résultats
 * — il n'y en a pas encore, et en inventer serait pire que se taire. Il dit
 * trois choses : nous avons bien votre adresse et votre site, votre espace
 * existe, et voici comment y revenir.
 *
 * Le dernier point n'est pas un détail. Le compte a été ouvert sans mot de
 * passe : la session vit dans le navigateur qui a lancé l'analyse, et rien
 * d'autre. Sans ce message, un visiteur qui ferme son onglet perd l'accès à un
 * espace dont il ignore jusqu'à l'existence. Le lien « choisir un mot de
 * passe » est donc le seul contenu vraiment indispensable de l'e-mail.
 */
export function freeAnalysisStartedEmail({
  domain,
  email,
}: {
  /** Le site que le visiteur vient de faire analyser, s'il est connu. */
  domain?: string | null;
  /** L'adresse du compte, reportée dans le lien de mot de passe. */
  email: string;
}): EmailContent {
  const dashboardUrl = `${SITE.url}${ROUTES.dashboard}`;
  const passwordUrl = `${SITE.url}${ROUTES.forgotPassword}?email=${encodeURIComponent(email)}`;
  const site = domain ? escapeHtml(domain) : "votre site";
  const sitePlain = domain ?? "votre site";

  const html = layout(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;">
      Votre analyse est lancée
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Bonjour,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">
      Nous lisons ${site} page par page, puis nous posons à ChatGPT et à Gemini
      les questions que vos clients leur posent déjà — pour voir si votre nom
      sort, et à quelle place. Comptez une à trois minutes.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:24px;">
      Votre espace est ouvert : la note, le classement et les corrections à
      faire s'y affichent dès que l'analyse est finie.
    </p>
    ${button(dashboardUrl, "Ouvrir mon tableau de bord")}
    <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#71717a;">
      Pour revenir depuis un autre appareil, choisissez un mot de passe :
    </p>
    <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;">
      <a href="${passwordUrl}" style="color:#09090b;">${escapeHtml(passwordUrl)}</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
      Une question ? Répondez à cet e-mail, il arrive directement chez nous.
    </p>
  `);

  const text = [
    "Bonjour,",
    "",
    `Nous lisons ${sitePlain} page par page, puis nous posons à ChatGPT et à Gemini les questions que vos clients leur posent déjà — pour voir si votre nom sort, et à quelle place. Comptez une à trois minutes.`,
    "",
    "Votre espace est ouvert : la note, le classement et les corrections à faire s'y affichent dès que l'analyse est finie.",
    "",
    `Ouvrir votre tableau de bord : ${dashboardUrl}`,
    "",
    `Pour revenir depuis un autre appareil, choisissez un mot de passe : ${passwordUrl}`,
    "",
    "Une question ? Répondez à cet e-mail, il arrive directement chez nous.",
  ].join("\n");

  return {
    subject: `Votre analyse ${SITE.name} est lancée`,
    html,
    text,
  };
}
