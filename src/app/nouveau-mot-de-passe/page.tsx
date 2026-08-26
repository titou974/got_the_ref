import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaReset"), robots: { index: false, follow: false } };
}

/**
 * L'atterrissage du lien reçu par e-mail.
 *
 * Better Auth vérifie le jeton avant de rediriger ici : un lien périmé ou déjà
 * consommé arrive avec `?error=INVALID_TOKEN` et sans jeton. On montre alors
 * l'impasse et la sortie — redemander un lien — plutôt qu'un formulaire qui
 * échouerait après la saisie.
 *
 * Aucune session n'est requise : c'est précisément l'écran de qui ne peut plus
 * se connecter.
 */
export default async function NouveauMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = typeof raw === "string" ? raw : "";
  const invalid = !token || Boolean(params.error);

  const t = await getTranslations("auth");

  return (
    <AuthCard
      title={invalid ? t("resetInvalidTitle") : t("resetTitle")}
      subtitle={invalid ? t("resetInvalidSubtitle") : t("resetSubtitle")}
      backLabel={t("backHome")}
    >
      {invalid ? (
        <div className="space-y-4">
          <Link
            href={ROUTES.forgotPassword}
            className="block w-full cursor-pointer rounded-pill bg-cta py-4 text-center text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
          >
            {t("resetAskAgain")}
          </Link>
          <p className="text-center text-sm text-muted">
            <Link
              href={ROUTES.signIn}
              className="cursor-pointer underline decoration-pebble underline-offset-4 hover:text-text hover:decoration-obsidian"
            >
              {t("backToSignin")}
            </Link>
          </p>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthCard>
  );
}
