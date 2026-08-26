import "server-only";
import { Resend } from "resend";
import { SITE } from "@/constants/site";

/**
 * Envoi d'e-mails transactionnels via Resend.
 *
 * La clé est facultative : sans elle, l'application tourne quand même — les
 * envois sont journalisés au lieu d'être expédiés. C'est ce qui permet de
 * développer sans compte Resend, et d'éviter qu'un oubli de variable
 * d'environnement fasse échouer une demande de réinitialisation.
 */

const apiKey = process.env.RESEND_API_KEY;

/** Vrai si Resend est configuré ; sinon, les envois restent en console. */
export const isEmailEnabled = Boolean(apiKey);

/**
 * Expéditeur. Le domaine doit être vérifié chez Resend ; à défaut,
 * `onboarding@resend.dev` fonctionne mais n'expédie qu'à l'adresse du compte
 * Resend — utile pour un premier essai, pas pour la production.
 */
const FROM = process.env.RESEND_FROM ?? `${SITE.name} <onboarding@resend.dev>`;

/** Adresse de réponse : une réponse à un e-mail automatique doit arriver quelque part. */
const REPLY_TO = process.env.RESEND_REPLY_TO ?? SITE.contactEmail;

let client: Resend | null = null;

function getResend(): Resend {
  client ??= new Resend(apiKey);
  return client;
}

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  /** Version texte, pour les clients de messagerie qui n'affichent pas le HTML. */
  text: string;
  /**
   * Clé d'idempotence Resend : deux appels portant la même clé n'expédient
   * qu'un seul e-mail (fenêtre de 24 h). Évite le doublon quand un utilisateur
   * s'y reprend à deux fois.
   */
  idempotencyKey?: string;
};

/**
 * Expédie un e-mail. Ne lève jamais : un échec d'envoi ne doit pas faire tomber
 * l'action qui l'a déclenché — un mot de passe réinitialisé le reste même si
 * l'e-mail se perd en route. Renvoie `true` si Resend a accepté le message.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: SendEmailParams): Promise<boolean> {
  if (!isEmailEnabled) {
    console.warn(
      `[email] RESEND_API_KEY absente — e-mail non expédié à ${to} : « ${subject} »`,
    );
    return false;
  }

  try {
    const { data, error } = await getResend().emails.send(
      { from: FROM, to: [to], replyTo: REPLY_TO, subject, html, text },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (error) {
      console.error("[email] échec Resend :", error.message);
      return false;
    }

    console.info(`[email] expédié (${data?.id}) : « ${subject} »`);
    return true;
  } catch (e) {
    console.error("[email] exception à l'envoi :", e);
    return false;
  }
}
