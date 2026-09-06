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
 * Le logotype de l'e-mail de bienvenue, servi par le CDN de Resend.
 *
 * Il vient de la maquette dessinée dans Resend, et non de `/public` : la carte
 * de bienvenue est la seule à porter un visuel, et c'est ce fichier-là qui a
 * été calé pour elle. Une messagerie ne charge pas de SVG — le logo du site
 * n'existe qu'en SVG — et un PNG au nom de l'ancienne marque ferait un pas en
 * arrière visible.
 */
const WELCOME_LOGO_URL =
  "https://resend-attachments.s3.amazonaws.com/9293e2e6-a377-4307-b5e8-8f014489a6f3";

/** L'adresse à laquelle on répond, écrite en toutes lettres dans la carte. */
const WELCOME_CONTACT_EMAIL = "contact@gotheref.com";

/**
 * L'e-mail de bienvenue, expédié à la création du compte.
 *
 * Il ne partage pas l'enveloppe des autres messages (`@/lib/email-layout`) :
 * c'est une carte dessinée dans Resend, avec son logotype, son bloc « pour bien
 * commencer » et sa pilule d'action. Elle est reprise telle quelle, variables
 * substituées — la retoucher pour la faire rentrer dans l'enveloppe commune
 * reviendrait à la redessiner, et c'est précisément ce qu'on ne veut pas.
 *
 * Ce qu'elle dit tient en trois pas : la forme du commerce, l'adresse du site,
 * puis le tableau de bord. C'est l'ordre exact du tunnel de mise en route, et
 * le bouton y mène.
 *
 * Il part à toutes les inscriptions, par mot de passe comme par Google : le
 * déclencheur est la création de l'utilisateur, pas le formulaire emprunté. La
 * seule exception est le compte ouvert depuis l'analyse de la page d'accueil,
 * qui reçoit la confirmation de son analyse à la place (cf.
 * `features/leads/emails.ts`) : il a déjà donné ses deux réponses, et lui
 * demander de recommencer n'aurait pas de sens.
 */
export function welcomeEmail({ userName }: { userName?: string | null }): EmailContent {
  const url = `${SITE.url}${ROUTES.dashboard}`;
  // Le prénom seul : la carte s'adresse à une personne, pas à un identifiant de
  // compte. Sans nom connu, la phrase se referme sans virgule flottante.
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const heading = firstName
    ? `Bonjour ${escapeHtml(firstName)}, regardons ce que les IA disent de vous.`
    : "Regardons ce que les IA disent de vous.";
  const site = SITE.url.replace(/^https?:\/\//, "");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="fr"><head><meta content="width=device-width" name="viewport"/><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/><meta content="IE=edge" http-equiv="X-UA-Compatible"/><meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/><title>Explorez la plateforme, lancez votre projet et contactez l'équipe.</title><style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style></head><body dir="ltr" lang="fr" style="background-color:#f4f4f5;padding-top:0;padding-bottom:0;padding-right:0;padding-left:0"><div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">Explorez la plateforme, lancez votre projet et contactez l'équipe.</div><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td dir="ltr" lang="fr" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;font-size:1em;min-height:100%;line-height:155%;background-color:#f4f4f5;padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;color:#18181b"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;width:100%;border-radius:36px;line-height:155%"><tbody><tr style="width:100%"><td style="padding-top:40px;padding-right:40px;padding-bottom:40px;padding-left:40px"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"><tbody style="width:100%"><tr style="width:100%"><td align="center"><img alt="${escapeHtml(SITE.name)}" height="64" src="${WELCOME_LOGO_URL}" style="display:block;outline:none;border:none;text-decoration:none;border-radius:24px;margin-bottom:24px" width="64"/></td></tr></tbody></table><h1 style="margin:0;padding:0;font-size:40px;line-height:110%;padding-top:0.389em;font-weight:700;color:#09090b;letter-spacing:-1px;margin-top:0px;margin-bottom:20px">${heading}</h1><p style="margin:0;padding:0;font-size:16px;padding-top:0.5em;padding-bottom:0.5em;color:#52525b;line-height:160%;margin-bottom:32px">Votre compte est prêt. Vous pouvez dès maintenant explorer le logiciel, lancer votre première analyse et appliquer les correctifs pour gagner du trafic sur les IA. On a rendu la prise en main la plus simple possible.</p><table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="box-sizing:border-box;background-color:#f4f4f5;border-radius:28px;margin-bottom:32px"><tbody><tr><td style="padding-top:28px;padding-right:28px;padding-bottom:28px;padding-left:28px"><h3 style="margin:0;padding:0;font-size:18px;line-height:1.08em;padding-top:0.389em;font-weight:700;color:#09090b;margin-top:0px;margin-bottom:16px">Pour bien commencer</h3><p style="margin:0;padding:0;font-size:14px;padding-top:0.5em;padding-bottom:0.5em;color:#18181b;margin-top:0px;margin-bottom:10px">1. Sélectionnez votre type de commerce (physique ou en ligne).</p><p style="margin:0;padding:0;font-size:14px;padding-top:0.5em;padding-bottom:0.5em;color:#18181b;margin-top:0px;margin-bottom:10px">2. Renseignez l'URL de votre site (ainsi que celle de votre fiche Google Maps si vous avez un commerce physique).</p><p style="margin:0;padding:0;font-size:14px;padding-top:0.5em;padding-bottom:0.5em;color:#18181b;margin-top:0px;margin-bottom:0px">3. Découvrez votre tableau de bord, votre positionnement dans les IA et les correctifs à appliquer.</p></td></tr></tbody></table><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"><tbody style="width:100%"><tr style="width:100%"><td align="left"><a href="${url}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px;margin:0;box-sizing:border-box;padding-top:14px;padding-right:28px;padding-bottom:14px;padding-left:28px;background-color:#09090b;color:#ffffff;border-radius:9999px;font-weight:600;font-size:14px;text-align:center" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:10.5px">Analyser mon commerce</span></a></td></tr></tbody></table><p style="margin:0;padding:0;font-size:14px;padding-top:0.5em;padding-bottom:0.5em;color:#52525b;margin-top:40px;margin-bottom:0px">Une question ? Contactez-nous par mail via <a href="mailto:${WELCOME_CONTACT_EMAIL}" rel="noopener noreferrer nofollow" style="color:#09090b;text-decoration:underline" target="_blank"><u>${WELCOME_CONTACT_EMAIL}</u></a> ou par message privé sur notre Instagram, l'équipe vous répond en général sous quelques heures.</p><hr style="width:100%;border:none;border-top:1px solid #ececee;margin-top:40px;margin-bottom:24px"/><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"><tbody style="width:100%"><tr style="width:100%"><td align="center"><img alt="${escapeHtml(SITE.name)}" height="32" src="${WELCOME_LOGO_URL}" style="display:block;outline:none;border:none;text-decoration:none;border-radius:24px;margin-bottom:12px" width="32"/></td></tr></tbody></table><p style="margin:0;padding:0;font-size:12px;padding-top:0.5em;padding-bottom:0.5em;color:#a1a1aa;line-height:160%;margin-top:0px;margin-bottom:6px;text-align:center">${escapeHtml(SITE.name)}</p><p style="margin:0;padding:0;font-size:12px;padding-top:0.5em;padding-bottom:0.5em;color:#a1a1aa;line-height:160%;margin-top:0px;margin-bottom:0px;text-align:center">${escapeHtml(site)}</p></td></tr></tbody></table></td></tr></tbody></table></body></html>`;

  const text = [
    firstName
      ? `Bonjour ${firstName}, regardons ce que les IA disent de vous.`
      : "Regardons ce que les IA disent de vous.",
    "",
    "Votre compte est prêt. Vous pouvez dès maintenant explorer le logiciel, lancer votre première analyse et appliquer les correctifs pour gagner du trafic sur les IA.",
    "",
    "Pour bien commencer :",
    "1. Sélectionnez votre type de commerce (physique ou en ligne).",
    "2. Renseignez l'URL de votre site (ainsi que celle de votre fiche Google Maps si vous avez un commerce physique).",
    "3. Découvrez votre tableau de bord, votre positionnement dans les IA et les correctifs à appliquer.",
    "",
    `Analyser mon commerce : ${url}`,
    "",
    `Une question ? Écrivez-nous à ${WELCOME_CONTACT_EMAIL}, l'équipe répond en général sous quelques heures.`,
  ].join("\n");

  return {
    subject: `Bienvenue sur ${SITE.name}`,
    html,
    text,
  };
}
