import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * La clé du compte, rangée sur le poste du client.
 *
 * Un fichier plutôt qu'une variable d'environnement : l'appairage se fait une
 * fois, et le client ne devrait pas avoir à recoller un jeton dans la
 * configuration de chaque agent. Le fichier est écrit en 0600 — lisible par son
 * seul propriétaire —, comme une clé SSH.
 *
 * `GOT_THE_REF_TOKEN` reste prioritaire : c'est ce qui permet de faire tourner
 * l'agent dans une intégration continue, où il n'y a personne pour cliquer sur
 * un bouton d'autorisation.
 */

const FILE = join(homedir(), ".got_the_ref", "credentials.json");

type Credentials = {
  token: string;
  /** L'adresse à laquelle ce jeton vaut — un jeton de recette n'ouvre pas la production. */
  url: string;
  client: string;
  createdAt: string;
};

export function readToken(url: string): string | null {
  if (process.env.GOT_THE_REF_TOKEN) return process.env.GOT_THE_REF_TOKEN;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Credentials;
    if (!parsed.token) return null;
    // Un jeton accordé par une autre instance ne vaut rien ici : le présenter
    // reviendrait à faire échouer chaque appel sur une erreur d'authentification
    // dont la cause serait invisible.
    if (parsed.url && parsed.url !== url) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export function writeToken(token: string, url: string, client: string): void {
  mkdirSync(dirname(FILE), { recursive: true, mode: 0o700 });
  const payload: Credentials = { token, url, client, createdAt: new Date().toISOString() };
  writeFileSync(FILE, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(FILE, 0o600);
}

export function clearToken(): void {
  try {
    rmSync(FILE);
  } catch {
    /* déjà parti : rien à faire */
  }
}

/** Le chemin, pour le dire au client quand il demande où vit sa clé. */
export const CREDENTIALS_PATH = FILE;
