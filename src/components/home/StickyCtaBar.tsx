"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Portal } from "@/components/Portal";
import { ROUTES } from "@/constants/routes";

/** Repli si le hero n'est pas trouvé : hauteur d'un premier écran typique. */
const FALLBACK_THRESHOLD = 520;

/**
 * La barre d'appel en bas de la home. Elle reste absente tant que le hero est à
 * l'écran — le CTA du haut de page y suffit, deux boutons identiques côte à côte
 * ne feraient que se voler l'attention — puis se glisse par le bas dès qu'on
 * passe dessous, et suit le visiteur jusqu'en bas de page.
 *
 * Le seuil est mesuré sur le hero lui-même plutôt que sur une constante : la
 * hauteur du premier écran change du simple au double entre un téléphone et un
 * grand écran. On lit sa position au défilement plutôt que par
 * `IntersectionObserver`, qui ne se déclenche pas toujours dans les navigateurs
 * intégrés (Instagram, LinkedIn) ni sur une page restaurée du bfcache.
 *
 * `Portal` vers `<body>` : une couche `position: fixed` n'est plein écran que si
 * aucun ancêtre n'établit de bloc conteneur, et la home en compte plusieurs
 * (cartes qui se soulèvent au survol, calques floutés).
 */
export function StickyCtaBar({
  label,
  heroId,
  href = ROUTES.signUp,
}: {
  label: string;
  heroId: string;
  /** Le tableau de bord pour qui en a déjà un ; l'inscription sinon. */
  href?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById(heroId);
      const passed = hero
        ? hero.getBoundingClientRect().bottom <= 0
        : window.scrollY > FALLBACK_THRESHOLD;
      setVisible(passed);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [heroId]);

  return (
    <Portal>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 px-4"
            // La zone sûre évite que la barre se loge sous la barre d'outils de
            // Safari iOS, où l'appui ne l'atteindrait pas.
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          >
            <Link
              href={href}
              className="mx-auto flex w-full max-w-xl cursor-pointer items-center justify-center rounded-full bg-cta px-6 py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {label}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
