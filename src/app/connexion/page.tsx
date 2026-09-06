import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getSession } from "@/lib/auth";
import { resolveAuthDestination } from "@/features/auth/destination";
import { oauthErrorKey } from "@/features/auth/oauth-errors";
import {
  NEXT_PARAM,
  PASSWORD_RESET_PARAM,
  ROUTES,
  safeNextPath,
  signUpWithNext,
} from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignin"), robots: { index: false, follow: false } };
}

/**
 * La connexion sert deux publics : le client qui revient — il rentre chez lui,
 * c'est-à-dire sur son tableau de bord, quelle que soit son offre — et celui
 * qui venait souscrire et s'est aperçu qu'il avait déjà un compte. Pour ce
 * dernier, `?suite=` conserve le tunnel.
 *
 * Déjà identifié, on ne redemande rien : `resolveAuthDestination` tranche entre
 * l'accueil (le questionnaire n'a pas été rempli) et le tableau de bord.
 */
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = params[NEXT_PARAM];
  const next = safeNextPath(requested, ROUTES.dashboard);

  const session = await getSession();
  if (session) redirect(await resolveAuthDestination(session.user.id, requested));

  // Sans destination demandée, la bascule vers l'inscription garde la sienne :
  // lui imposer le tableau de bord n'aurait aucun sens pour qui n'a pas encore
  // de compte.
  const switchHref = requested ? signUpWithNext(next) : ROUTES.signUp;

  const errorKey = oauthErrorKey(params.error);
  const t = await getTranslations("auth");

  return (
    <AuthScreen
      mode="signin"
      callbackURL={next}
      switchHref={switchHref}
      error={errorKey ? t(errorKey) : null}
      notice={params[PASSWORD_RESET_PARAM] ? t("passwordResetDone") : null}
    />
  );
}
