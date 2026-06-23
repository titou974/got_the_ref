import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { getCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export async function Nav() {
  const user = await getCurrentUser();
  const t = await getTranslations("common");

  return (
    <header className="relative z-20 w-full">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <div className="flex items-center gap-5">
          <Link
            href={ROUTES.agency}
            className="hidden cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text sm:inline"
          >
            {t("agency")}
          </Link>
          <Link
            href={ROUTES.services}
            className="hidden cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text sm:inline"
          >
            {t("services")}
          </Link>
          <Link
            href={ROUTES.pricing}
            className="hidden cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text sm:inline"
          >
            {t("pricing")}
          </Link>
          {user ? (
            <>
              <Link
                href={ROUTES.account}
                className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
              >
                {t("account")}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href={ROUTES.signIn}
                className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
              >
                {t("signIn")}
              </Link>
              <Link
                href={ROUTES.signUp}
                className="cursor-pointer rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cta-hover"
              >
                {t("freeTrial")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
