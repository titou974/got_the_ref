import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { NavCta } from "./NavCta";
import { MobileMenu } from "./MobileMenu";
import { getCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export async function Nav({ minimal = false }: { minimal?: boolean } = {}) {
  const user = await getCurrentUser();
  const t = await getTranslations("common");

  // Rapport d'analyse et tarifs : aucune sortie latérale. À ces deux endroits, le
  // visiteur est dans un parcours de décision — seul le compte reste accessible.
  const links = minimal
    ? []
    : [
        { href: ROUTES.agency, label: t("agency") },
        { href: ROUTES.demo, label: t("demo") },
        { href: ROUTES.contact, label: t("contact") },
        { href: ROUTES.pricing, label: t("pricing") },
      ];

  return (
    <header className="relative z-20 w-full">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Logo />

        {/* Barre desktop */}
        <div className="hidden items-center gap-5 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
            >
              {l.label}
            </Link>
          ))}
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
            <Link
              href={ROUTES.signIn}
              className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
            >
              {t("signIn")}
            </Link>
          )}
          {!minimal && <NavCta label={t("analyzeMyBusiness")} />}
        </div>

        {/* Mobile : réduit, le lien compte suffit ; complet, la sidebar habituelle. */}
        {minimal ? (
          <div className="flex items-center gap-4 sm:hidden">
            {user ? (
              <Link href={ROUTES.account} className="cursor-pointer text-sm text-muted hover:text-text">
                {t("account")}
              </Link>
            ) : (
              <Link href={ROUTES.signIn} className="cursor-pointer text-sm text-muted hover:text-text">
                {t("signIn")}
              </Link>
            )}
          </div>
        ) : (
          <MobileMenu
            links={links}
            isAuthenticated={!!user}
            labels={{
              menu: t("menu"),
              closeMenu: t("closeMenu"),
              account: t("account"),
              signIn: t("signIn"),
              analyzeMyBusiness: t("analyzeMyBusiness"),
            }}
          />
        )}
      </nav>
    </header>
  );
}
