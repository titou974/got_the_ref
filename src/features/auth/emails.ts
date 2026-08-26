import "server-only";
import { SITE } from "@/constants/site";

/**
 * Les e-mails d'authentification, en HTML de messagerie : tableaux, styles en
 * ligne, aucune feuille externe — les clients lourds (Outlook, Gmail) ignorent
 * le reste. Le rendu reste celui de la marque : fond gris pâle, carte blanche,
 * bouton pilule noire.
 */

/**
 * Durée de validité du lien de réinitialisation. Une heure : assez pour
 * relever sa boîte sans laisser un lien ouvert traîner dans un fil d'e-mails.
 * Partagée avec la configuration Better Auth pour que la promesse faite dans
 * le message corresponde à la réalité du jeton.
 */
export const RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60;

/** Échappe le texte inséré dans le HTML (le nom vient de l'utilisateur). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Enveloppe commune : la carte blanche, le logotype et le pied de page. */
function layout(bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#09090b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ececee;border-radius:20px;padding:32px;">
            <tr>
              <td style="padding-bottom:24px;font-size:18px;font-weight:700;letter-spacing:-0.01em;">
                ${escapeHtml(SITE.name)}
              </td>
            </tr>
            <tr>
              <td>${bodyHtml}</td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:#71717a;">
                ${escapeHtml(SITE.tagline)}<br />
                <a href="${SITE.url}" style="color:#71717a;">${escapeHtml(SITE.url.replace(/^https?:\/\//, ""))}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type EmailContent = { subject: string; html: string; text: string };

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
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-radius:9999px;background:#09090b;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:9999px;">
            Choisir un nouveau mot de passe
          </a>
        </td>
      </tr>
    </table>
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
