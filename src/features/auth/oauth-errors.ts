/**
 * Les échecs de retour Google, ramenés à une clé de traduction.
 *
 * Better Auth renvoie le navigateur sur `errorCallbackURL` avec un code dans
 * `?error=`. Le plus parlant est `account_not_linked` : un compte existe déjà
 * avec cette adresse mais n'a pas été rattaché à Google — la personne doit
 * passer par la connexion. Les autres codes désignent une session OAuth
 * abîmée, où la seule consigne utile est de recommencer.
 */
export type OAuthErrorKey = "googleErrorExisting" | "googleError";

export function oauthErrorKey(raw: unknown): OAuthErrorKey | null {
  if (typeof raw !== "string" || !raw) return null;
  const code = raw.toLowerCase();
  if (code.includes("account_not_linked") || code.includes("email_already")) {
    return "googleErrorExisting";
  }
  return "googleError";
}
