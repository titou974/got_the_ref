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
  return { title: t("metaSignup"), robots: { index: false, follow: false } };
}

export default async function InscriptionPage() {
  if (await getSession()) redirect(ROUTES.account);
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-8">
        <h1 className="text-center text-2xl font-bold">{t("signupTitle")}</h1>
        <p className="mt-1 mb-6 text-center text-sm text-muted">{t("signupSubtitle")}</p>
        <AuthForm mode="signup" />
      </div>
      <Link href={ROUTES.home} className="mt-6 cursor-pointer text-sm text-muted hover:text-text">
        {t("backHome")}
      </Link>
    </main>
  );
}
