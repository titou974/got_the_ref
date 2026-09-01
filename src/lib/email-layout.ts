import "server-only";
import { SITE } from "@/constants/site";

/**
 * L'habillage commun des e-mails transactionnels.
 *
 * HTML de messagerie : tableaux, styles en ligne, aucune feuille externe — les
 * clients lourds (Outlook, Gmail) ignorent le reste. Le rendu reste celui de la
 * marque : fond gris pâle, carte blanche, bouton pilule noire.
 *
 * Extrait des e-mails d'authentification le jour où le tableau de bord a eu ses
 * propres messages à envoyer. Deux enveloppes recopiées auraient divergé à la
 * première retouche, et un client reçoit les deux : le mot de passe oublié et
 * l'analyse terminée doivent venir du même expéditeur, visiblement.
 */

export type EmailContent = { subject: string; html: string; text: string };

/** Échappe le texte inséré dans le HTML (nom, niche et domaine viennent de l'extérieur). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Enveloppe commune : la carte blanche, le logotype et le pied de page. */
export function layout(bodyHtml: string): string {
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

/** Le bouton d'action : la pilule noire du système, en HTML de messagerie. */
export function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-radius:9999px;background:#09090b;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:9999px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Une ligne de chiffre : l'intitulé à gauche, la valeur à droite, un filet
 * dessous. Assez pour un relevé de quatre lignes, et rien de plus — une
 * maquette de tableau de bord ne se recopie pas dans un e-mail.
 */
export function statRow(label: string, value: string): string {
  return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #ececee;font-size:14px;line-height:20px;color:#71717a;">
        ${escapeHtml(label)}
      </td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid #ececee;font-size:15px;line-height:20px;font-weight:600;">
        ${escapeHtml(value)}
      </td>
    </tr>`;
}
