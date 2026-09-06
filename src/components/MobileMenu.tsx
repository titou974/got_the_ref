"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SignOutButton } from "./SignOutButton";
import { Portal } from "./Portal";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { ROUTES } from "@/constants/routes";

type NavLink = { href: string; label: string };

type Labels = {
  menu: string;
  closeMenu: string;
  account: string;
  signIn: string;
  freeTrial: string;
};

/**
 * Menu mobile en sidebar : évite que les liens débordent de la navbar sur
 * petit écran. Hamburger → tiroir latéral animé (framer-motion).
 *
 * Réservé à la home. Ailleurs, le visiteur est engagé dans un parcours — rapport,
 * tarifs, inscription, compte — et la barre n'y garde que le logo et le compte.
 *
 * ⚠️ Le tiroir et son voile passent par un `Portal` vers `<body>`. Une couche
 * `position: fixed` n'est plein écran que si aucun ancêtre n'établit de bloc
 * conteneur : or l'en-tête est désormais `sticky` avec un `backdrop-blur`, et un
 * `backdrop-filter` en établit un. Rendu dans la barre, le tiroir se replierait
 * sur la hauteur de celle-ci — de l'extérieur, le bouton « n'ouvre rien ». Le
 * portail le met hors d'atteinte de tout ancêtre transformé ou flouté.
 */
export function MobileMenu({
  links,
  isAuthenticated,
  hasWorkspace = false,
  pendingHref = ROUTES.pricing,
  labels,
}: {
  links: NavLink[];
  isAuthenticated: boolean;
  /**
   * Ce compte a-t-il un espace qui tourne — accueil signé ou analyse faite ?
   * Sinon le tiroir ne lui promet pas de tableau de bord : il l'emmène aux
   * offres, qui sont ce qui lui manque (même règle que la barre desktop).
   */
  hasWorkspace?: boolean;
  /**
   * Où l'emmener tant que son espace ne tourne pas. La barre le calcule — la
   * branche du test de parcours décide entre la grille tarifaire et le tunnel
   * d'accueil — et le tiroir suit, pour que les deux disent la même chose.
   */
  pendingHref?: string;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === ROUTES.home;

  // Verrouille le scroll de la page tant que le tiroir est ouvert.
  useBodyScrollLock(open);

  if (!isHome) return null;

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.menu}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-fog bg-snow text-text transition-colors duration-200 hover:border-pebble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <Portal>
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-[90] cursor-pointer bg-obsidian/40 backdrop-blur-[1px] sm:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <motion.aside
                key="drawer"
                // `inset-y-0` plutôt qu'une hauteur en unités de viewport : le
                // tiroir se cale sur son bloc conteneur — le viewport, grâce au
                // portail — sans dépendre du support de `dvh` ni des barres
                // d'outils mobiles qui font varier `vh`.
                className="fixed inset-y-0 left-0 z-[95] flex w-72 max-w-[82vw] flex-col bg-snow shadow-[var(--shadow-md)] sm:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                role="dialog"
                aria-modal="true"
              >
                <div className="flex items-center justify-end px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={labels.closeMenu}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-fog text-text transition-colors duration-200 hover:border-pebble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <nav className="flex flex-1 flex-col gap-1 px-5 pt-2">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="cursor-pointer rounded-xl px-3 py-3 text-base font-medium text-text transition-colors duration-200 hover:bg-mist"
                    >
                      {l.label}
                    </Link>
                  ))}
                  {isAuthenticated ? (
                    <>
                      <Link
                        href={hasWorkspace ? ROUTES.dashboard : pendingHref}
                        onClick={() => setOpen(false)}
                        className="cursor-pointer rounded-xl px-3 py-3 text-base font-medium text-text transition-colors duration-200 hover:bg-mist"
                      >
                        {hasWorkspace ? labels.account : labels.freeTrial}
                      </Link>
                      <SignOutButton className="rounded-xl px-3 py-3 text-left text-base hover:bg-mist" />
                    </>
                  ) : (
                    <Link
                      href={ROUTES.signIn}
                      onClick={() => setOpen(false)}
                      className="cursor-pointer rounded-xl px-3 py-3 text-base font-medium text-text transition-colors duration-200 hover:bg-mist"
                    >
                      {labels.signIn}
                    </Link>
                  )}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}
