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
        { href: ROUTES.demo, label: t("demo") },
        { href: ROUTES.contact, label: t("contact") },
        { href: ROUTES.pricing, label: t("pricing") },
      ];

  const accountLink = user ? (
    <Link
      href={ROUTES.account}
      className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
    >
      {t("account")}
    </Link>
  ) : (
    <Link
      href={ROUTES.signIn}
      className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
    >
      {t("signIn")}
    </Link>
  );

  return (
    // Barre collante sur tout le site : le logo et le compte restent à portée
    // quelle que soit la profondeur de la page. `sticky` plutôt que `fixed` —
    // l'en-tête garde sa place dans le flux, donc aucune page n'a à réserver
    // l'espace sous la barre.
    //
    // `z-50` la met au-dessus du contenu et de la pilule flottante (`z-30`),
    // mais sous les calques modaux (`z-[90]` et plus) : le tiroir mobile et
    // l'overlay d'analyse continuent de la recouvrir.
    <header className="sticky top-0 z-50 w-full border-b border-fog/60 bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4">
        {/* Le déclencheur du tiroir se place à gauche du logo — c'est le premier
            geste attendu sur mobile, il vient donc avant la marque. */}
        <div className="flex items-center gap-3">
          {!minimal && (
            <MobileMenu
              links={links}
              isAuthenticated={!!user}
              labels={{
                menu: t("menu"),
                closeMenu: t("closeMenu"),
                account: t("account"),
                signIn: t("signIn"),
              }}
            />
          )}
          <Logo />
        </div>

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
              {accountLink}
              <SignOutButton />
            </>
          ) : (
            accountLink
          )}
          {!minimal && <NavCta label={t("analyzeMyBusiness")} />}
        </div>

        {/* Mobile : le tiroir porte déjà la navigation là où il existe, mais le
            compte reste accessible en un geste partout. */}
        <div className="flex items-center gap-4 sm:hidden">{accountLink}</div>
      </nav>
    </header>
  );
}
