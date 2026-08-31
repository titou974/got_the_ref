import "server-only";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import {
  button,
  escapeHtml,
  layout,
  type EmailContent,
} from "@/lib/email-layout";

/**
 * Les e-mails d'authentification. L'habillage est commun à tous les messages
 * transactionnels (cf. `@/lib/email-layout`) ; seul le contenu vit ici.
 */

export type { EmailContent };

/**
 * Durée de validité du lien de réinitialisation. Une heure : assez pour
 * relever sa boîte sans laisser un lien ouvert traîner dans un fil d'e-mails.
 * Partagée avec la configuration Better Auth pour que la promesse faite dans
 * le message corresponde à la réalité du jeton.
 */
export const RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * L'e-mail de réinitialisation de mot de passe.
 *
 * Le lien est répété en clair sous le bouton : certains clients de messagerie
 * n'affichent pas les boutons, et une adresse visible rassure sur la
 * destination — c'est aussi ce qui distingue ce message d'un hameçonnage.
 */
export function resetPasswordEmail({
  url,
  userName,
}: {
  /** Lien de réinitialisation fourni par Better Auth (jeton compris). */
  url: string;
  /** Prénom ou nom affiché, s'il est connu. */
  userName?: string | null;
}): EmailContent {
  const hello = userName ? `Bonjour ${escapeHtml(userName)},` : "Bonjour,";
  const validity = `${Math.round(RESET_PASSWORD_TOKEN_TTL_SECONDS / 60)} minutes`;

  const html = layout(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;">
      Réinitialiser votre mot de passe
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:24px;">${hello}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:24px;">
      Vous avez demandé un nouveau mot de passe pour votre compte ${escapeHtml(SITE.name)}.
      Ce lien est valable ${validity}.
    </p>
    ${button(url, "Choisir un nouveau mot de passe")}
    <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#71717a;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
    </p>
    <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;">
      <a href="${url}" style="color:#09090b;">${url}</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
      Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre
      mot de passe actuel reste valable.
    </p>
  `);

  const text = [
    userName ? `Bonjour ${userName},` : "Bonjour,",
    "",
    `Vous avez demandé un nouveau mot de passe pour votre compte ${SITE.name}.`,
    `Ouvrez ce lien pour en choisir un (valable ${validity}) :`,
    url,
    "",
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste valable.",
  ].join("\n");

  return {
    subject: `Réinitialiser votre mot de passe ${SITE.name}`,
    html,
    text,
  };
}

/**
 * L'e-mail de bienvenue, expédié à la création du compte.
 *
 * Il arrive pendant que le client remplit le tunnel d'accueil, ou juste après :
 * ce n'est donc pas le moment de lui vendre quoi que ce soit, ni de lui faire
 * la leçon sur le GEO. Il dit trois choses et s'arrête — ce qu'on est en train
 * de faire de son site, ce qu'il recevra, et par où revenir. Le second e-mail,
 * celui de l'analyse terminée, portera les chiffres ; celui-ci n'en a aucun à
 * donner, et en inventer serait le rendre inutile.
 *
 * Il part à toutes les inscriptions, par mot de passe comme par Google : le
 * déclencheur est la création de l'utilisateur, pas le formulaire emprunté.
 */
export function welcomeEmail({ userName }: { userName?: string | null }): EmailContent {
  const hello = userName ? `Bonjour ${escapeHtml(userName)},` : "Bonjour,";
  const url = `${SITE.url}${ROUTES.dashboard}`;

  const html = layout(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;">
      Bienvenue sur ${escapeHtml(SITE.name)}
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:24px;">${hello}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">
      Votre compte est ouvert. Dès que vous nous aurez donné l'adresse de votre
      site, nous lisons vos pages et nous posons à ChatGPT et à Gemini les
      questions que vos clients leur posent déjà — pour voir si votre nom sort,
      et à quelle place.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:24px;">
      Comptez une à trois minutes d'analyse. Vous recevrez vos résultats par
      e-mail : votre note, votre place dans les réponses IA et ce qu'il faut
      corriger en premier.
    </p>
    ${button(url, "Ouvrir mon tableau de bord")}
    <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
      Une question ? Répondez à cet e-mail, il arrive directement chez nous.
    </p>
  `);

  const text = [
    userName ? `Bonjour ${userName},` : "Bonjour,",
    "",
    "Votre compte est ouvert. Dès que vous nous aurez donné l'adresse de votre site, nous lisons vos pages et nous posons à ChatGPT et à Gemini les questions que vos clients leur posent déjà — pour voir si votre nom sort, et à quelle place.",
    "",
    "Comptez une à trois minutes d'analyse. Vous recevrez vos résultats par e-mail : votre note, votre place dans les réponses IA et ce qu'il faut corriger en premier.",
    "",
    `Ouvrir votre tableau de bord : ${url}`,
    "",
    "Une question ? Répondez à cet e-mail, il arrive directement chez nous.",
  ].join("\n");

  return {
    subject: `Bienvenue sur ${SITE.name}`,
    html,
    text,
  };
}
