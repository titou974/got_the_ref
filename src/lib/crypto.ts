import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Chiffrement des identifiants de plateforme avant écriture en base.
 *
 * Ces jetons ouvrent le site du client en écriture : un dump de la base ne doit
 * pas suffire à publier chez lui. AES-256-GCM, clé dérivée de `CREDENTIALS_KEY`,
 * nonce tiré au sort à chaque écriture et rangé devant le texte chiffré.
 *
 * Format stocké : `v1.<iv base64url>.<tag base64url>.<chiffré base64url>`. Le
 * préfixe de version évite d'avoir à deviner plus tard comment relire une ligne
 * écrite aujourd'hui.
 */

const VERSION = "v1";

function key(): Buffer {
  const secret = process.env.CREDENTIALS_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "CREDENTIALS_KEY manquante ou trop courte (32 caractères au minimum) : impossible de chiffrer les identifiants de plateforme.",
    );
  }
  // SHA-256 ramène n'importe quelle phrase secrète aux 32 octets qu'attend
  // AES-256, sans imposer au déploiement une clé au format exact.
  return createHash("sha256").update(secret).digest();
}

export const isCredentialsKeySet = (): boolean =>
  Boolean(process.env.CREDENTIALS_KEY && process.env.CREDENTIALS_KEY.length >= 32);

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Relit une valeur chiffrée. Renvoie `null` plutôt que de lever si le format ne
 * correspond pas ou si le tag d'authentification est faux : côté appelant, un
 * lien illisible se traite comme un lien à refaire, pas comme une panne.
 */
export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) return null;

  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}
