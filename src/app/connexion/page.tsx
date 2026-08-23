import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getSession } from "@/lib/auth";
import { NEXT_PARAM, ROUTES, safeNextPath, signUpWithNext } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignin"), robots: { index: false, follow: false } };
}

/**
 * La connexion sert deux publics : le client qui revient — il retrouve son
 * compte — et celui qui venait souscrire et s'est aperçu qu'il avait déjà un
 * compte. Pour ce dernier, `?suite=/tarifs` conserve le tunnel.
 */
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = (await searchParams)[NEXT_PARAM];
  const next = safeNextPath(requested, ROUTES.account);

  if (await getSession()) redirect(next);

  // Sans destination demandée, la bascule vers l'inscription garde la sienne
  // (les tarifs) : lui imposer `/compte` sortirait le visiteur du tunnel.
  const switchHref = requested ? signUpWithNext(next) : ROUTES.signUp;

  return <AuthScreen mode="signin" callbackURL={next} switchHref={switchHref} />;
}
