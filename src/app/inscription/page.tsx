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
 * L'inscription ouvre un compte, puis l'accueil : le questionnaire arme les
 * agents, et le tableau de bord suit. Elle ne dépose plus personne sur la
 * grille tarifaire — c'est le compte gratuit qui montre le produit, et l'offre
 * se vend depuis le tableau de bord (cf. `destination.ts`).
 *
 * Pour qui possède déjà un compte — le cas courant depuis que Google ouvre une
 * session au lieu de refuser une adresse connue —, `resolveAuthDestination` le
 * renvoie chez lui sans repasser par le formulaire.
 */
export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = params[NEXT_PARAM];
  const next = safeNextPath(requested, ROUTES.dashboard);

  // Déjà identifié : inutile de redemander — reste à savoir où l'emmener.
  const session = await getSession();
  if (session) redirect(await resolveAuthDestination(session.user.id, requested));

  const errorKey = oauthErrorKey(params.error);
  const t = await getTranslations("auth");

  // Sans destination demandée, la bascule vers la connexion n'en invente pas :
  // c'est ce qui envoyait un client de longue date sur `/connexion?suite=/tarifs`,
  // et donc sur la grille tarifaire, après s'être identifié.
  return (
    <AuthScreen
      mode="signup"
      callbackURL={next}
      switchHref={requested ? signInWithNext(next) : ROUTES.signIn}
      error={errorKey ? t(errorKey) : null}
    />
  );
}
