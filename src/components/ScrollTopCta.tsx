"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Bouton flottant « Analyser » affiché uniquement sur mobile.
 * La home est non-scrollable sur PC, mais scrollable sur mobile : dès que
 * l'on descend sous le pli, ce bouton apparaît (framer-motion) et ramène
 * en haut, là où se trouve le champ d'analyse.
 */
export function ScrollTopCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

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
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.92 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 lg:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {label}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
