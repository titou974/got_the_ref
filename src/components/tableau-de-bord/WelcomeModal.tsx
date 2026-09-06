"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { parseSegments } from "@/lib/rich-text";
import { lockScroll } from "@/lib/scroll-lock";
import { AiOverview, type OverviewBlock } from "@/components/dashboard/AiOverview";

/**
 * Le mot d'accueil, à la première arrivée sur le tableau de bord.
 *
 * Il reprend exactement la carte du rapport — en-tête signé, texte qui s'écrit,
 * pastille de source. Le client vient de découvrir son analyse sous cette forme :
 * lui parler dans le même cadre dit que c'est la même maison qui continue, et
 * non un bandeau publicitaire posé par-dessus.
 *
 * Une seule fois, retenue dans le navigateur. Un mot de bienvenue répété à
 * chaque visite devient une porte à pousser avant d'entrer chez soi.
 *
 * Le texte tient en cinq lignes : sur un téléphone, un mot d'accueil qu'il faut
 * faire défiler pour atteindre son bouton n'est plus un accueil. La formule de
 * politesse finale est partie avec — le bouton « C'est parti » la porte déjà.
 */
const SEEN_KEY = "gotref:welcome:v1";

/** Le temps que la page se pose avant que le calque ne monte. */
const APPEAR_MS = 480;

export function WelcomeModal() {
  const t = useTranslations("dashboard.welcome");
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Un navigateur qui refuse le stockage (navigation privée verrouillée) ne
    // doit pas priver le client du message : on affiche, sans mémoire.
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    const timer = setTimeout(() => setOpen(true), APPEAR_MS);
    return () => clearTimeout(timer);
  }, []);

  // Verrou de scroll + Échap, tant que le calque est là.
  useEffect(() => {
    if (!open) return;
    const release = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* stockage refusé : le message reviendra à la prochaine visite */
    }
  }

  const blocks: OverviewBlock[] = [
    { kind: "paragraph", segments: parseSegments(t("intro")) },
    { kind: "chip", text: t("sourceChip") },
    { kind: "bullet", icon: "dot", segments: parseSegments(t("desktop")) },
    // La bulle Crisp est montée par le layout du tableau de bord : elle est
    // donc bien là, en bas à droite, au moment où le client lit cette ligne.
    { kind: "bullet", icon: "dot", segments: parseSegments(t("chat")) },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          {/* Le voile. Cliquable : on sort d'un mot de bienvenue comme on
              referme une porte, sans chercher le bouton. */}
          <motion.button
            type="button"
            aria-label={t("dismissAria")}
            onClick={dismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.32, ease: "easeOut" }}
            className="absolute inset-0 cursor-default bg-obsidian/25 backdrop-blur-[3px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("headline")}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 230, damping: 26, mass: 0.9 }
            }
            className="relative max-h-[86dvh] w-full max-w-lg overflow-y-auto overscroll-contain"
          >
            <AiOverview
              headline={t("headline")}
              blocks={blocks}
              reserveSpace
              footer={
                <button
                  ref={closeRef}
                  type="button"
                  onClick={dismiss}
                  className="mt-6 w-full cursor-pointer rounded-pill bg-cta px-6 py-3.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
                >
                  {t("dismiss")}
                </button>
              }
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
