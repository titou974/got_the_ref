import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getSession } from "@/lib/auth";
import { resolveAuthDestination } from "@/features/auth/destination";
import { oauthErrorKey } from "@/features/auth/oauth-errors";
import { NEXT_PARAM, ROUTES, safeNextPath, signInWithNext } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignup"), robots: { index: false, follow: false } };
}

/**
 * L'inscription s'intercale entre la home et les tarifs : on sait qui l'on
 * accueille avant de parler d'argent. La destination par défaut est donc la
 * page tarifs — et non le compte.
 *
 * Sauf pour qui possède déjà un compte : la grille tarifaire n'a rien à lui
 * dire, et c'est le cas courant depuis que Google ouvre une session au lieu de
 * refuser une adresse connue. `resolveAuthDestination` le renvoie chez lui.
 */
export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params[NEXT_PARAM], ROUTES.pricing);

  // Déjà identifié : inutile de redemander — reste à savoir où l'emmener.
  const session = await getSession();
  if (session) redirect(await resolveAuthDestination(session.user.id, next));

  const errorKey = oauthErrorKey(params.error);
  const t = await getTranslations("auth");

  return (
    <AuthScreen
      mode="signup"
      callbackURL={next}
      switchHref={signInWithNext(next)}
      error={errorKey ? t(errorKey) : null}
    />
  );
}
