"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SignOutButton } from "./SignOutButton";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { ROUTES } from "@/constants/routes";

type NavLink = { href: string; label: string };

type Labels = {
  menu: string;
  closeMenu: string;
  account: string;
  signIn: string;
  analyzeMyBusiness: string;
};

/**
 * Menu mobile en sidebar : évite que les liens débordent de la navbar sur
 * petit écran. Hamburger → tiroir latéral animé (framer-motion).
 * Le CTA « Analyser mon commerce » ramène en home et disparaît si on y est.
 */
export function MobileMenu({
  links,
  isAuthenticated,
  labels,
}: {
  links: NavLink[];
  isAuthenticated: boolean;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === ROUTES.home;

  // Verrouille le scroll de la page tant que le tiroir est ouvert.
  useBodyScrollLock(open);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.menu}
        aria-expanded={open}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-fog bg-snow text-text transition-colors duration-200 hover:border-pebble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-obsidian/40 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.aside
              key="drawer"
              className="fixed right-0 top-0 z-50 flex h-dvh w-72 max-w-[82vw] flex-col bg-snow shadow-[var(--shadow-md)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
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
                      href={ROUTES.account}
                      onClick={() => setOpen(false)}
                      className="cursor-pointer rounded-xl px-3 py-3 text-base font-medium text-text transition-colors duration-200 hover:bg-mist"
                    >
                      {labels.account}
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

              {!isHome && (
                <div className="px-5 pb-8 pt-4">
                  <Link
                    href={ROUTES.home}
                    onClick={() => setOpen(false)}
                    className="flex w-full cursor-pointer items-center justify-center rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
                  >
                    {labels.analyzeMyBusiness}
                  </Link>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
