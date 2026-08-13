import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="relative z-10 border-t border-fog px-5 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
        <p>{t("rights", { year: new Date().getFullYear() })}</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href={ROUTES.agency} className="cursor-pointer transition-colors duration-200 hover:text-text">
            {t("agency")}
          </Link>
          <Link href={ROUTES.demo} className="cursor-pointer transition-colors duration-200 hover:text-text">
            {t("demo")}
          </Link>
          <Link href={ROUTES.contact} className="cursor-pointer transition-colors duration-200 hover:text-text">
            {t("contact")}
          </Link>
          <Link href={ROUTES.pricing} className="cursor-pointer transition-colors duration-200 hover:text-text">
            {t("pricing")}
          </Link>
          <Link href={ROUTES.legal.mentions} className="cursor-pointer transition-colors duration-200 hover:text-text">
            {t("legalMentions")}
          </Link>
          <Link href={ROUTES.legal.terms} className="cursor-pointer transition-colors duration-200 hover:text-text">
            {t("terms")}
          </Link>
          <Link
            href={ROUTES.legal.privacy}
            className="cursor-pointer transition-colors duration-200 hover:text-text"
          >
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
