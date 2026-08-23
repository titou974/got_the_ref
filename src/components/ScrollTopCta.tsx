"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Bouton flottant « Analyser ». Dès que l'on descend sous le pli, il apparaît
 * (framer-motion) et emmène au champ d'analyse, désormais placé au milieu de la
 * page. Si l'ancre venait à disparaître, on retombe sur le haut de page plutôt
 * que de ne rien faire.
 */
export function ScrollTopCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  function goToAnalyze() {
    const target = document.getElementById("analyser");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={goToAnalyze}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.92 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          // `bottom` inclut la zone sûre : sinon la pilule se loge sous la barre
          // d'outils de Safari iOS, où l'appui ne l'atteint pas.
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          className="fixed left-1/2 z-30 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {label}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
