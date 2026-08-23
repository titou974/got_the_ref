import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getSession } from "@/lib/auth";
import { NEXT_PARAM, ROUTES, safeNextPath, signInWithNext } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignup"), robots: { index: false, follow: false } };
}

/**
 * L'inscription s'intercale entre la home et les tarifs : on sait qui l'on
 * accueille avant de parler d'argent. La destination par défaut est donc la
 * page tarifs — et non le compte.
 */
export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams)[NEXT_PARAM], ROUTES.pricing);

  // Déjà identifié : inutile de redemander, on l'emmène où il allait.
  if (await getSession()) redirect(next);

  return (
    <AuthScreen
      mode="signup"
      callbackURL={next}
      switchHref={signInWithNext(next)}
    />
  );
}
