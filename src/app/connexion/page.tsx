import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignin") };
}

export default async function ConnexionPage() {
  if (await getSession()) redirect(ROUTES.account);
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <Logo className="mb-8" />
      <div className="glass-strong w-full max-w-sm rounded-2xl p-6 sm:p-8">
        <h1 className="text-center text-2xl font-bold">{t("signinTitle")}</h1>
        <p className="mt-1 mb-6 text-center text-sm text-muted">{t("signinSubtitle")}</p>
        <AuthForm mode="signin" />
      </div>
      <Link href={ROUTES.home} className="mt-6 cursor-pointer text-sm text-muted hover:text-text">
        {t("backHome")}
      </Link>
    </main>
  );
}
