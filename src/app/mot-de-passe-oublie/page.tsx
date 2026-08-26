import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getSession } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaForgot"), robots: { index: false, follow: false } };
}

/**
 * Saisie de l'adresse pour recevoir un lien de réinitialisation.
 *
 * Déjà connecté, on n'a rien à faire ici : le changement de mot de passe passe
 * alors par l'espace compte, sans détour par la boîte e-mail.
 */
export default async function MotDePasseOubliePage() {
  if (await getSession()) redirect(ROUTES.account);

  const t = await getTranslations("auth");

  return (
    <AuthCard
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      backLabel={t("backHome")}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
