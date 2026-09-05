"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { lockScroll } from "@/lib/scroll-lock";
import { StructureScene } from "./architecture/StructureScene";

/**
 * Ce que fait la page Architecture, à la première arrivée dessus.
 *
 * L'écran ouvre sur une arborescence de fichiers, des pastilles monospace et un
 * bouton de dépôt. Le client y lit « llms.txt : absent » sans savoir ce qu'est
 * un llms.txt, qui le demande, ni ce qu'il perd tant qu'il n'en a pas. La
 * fenêtre répond aux trois, puis rend la main : ce qu'un moteur de réponse
 * cherche à la racine, ce que l'analyse n'y a pas trouvé, et qui dépose les
 * fichiers manquants.
 *
 * Elle ne s'ouvre que pour les offres qui ouvrent l'architecture. Sous une offre
 * qui la ferme, la page entière passe sous voile : expliquer un écran que le
 * client ne peut pas lire reviendrait à vendre.
 *
 * Une seule fois, retenue dans le navigateur dès l'ouverture, comme les deux
 * autres. Le temps courant se lit dans la règle de progression, qui sert aussi
 * de navigation : les trois segments se cliquent.
 */
const SEEN_KEY = "gotref:structure-intro:v1";

/** Le temps que la page se pose avant que le calque ne monte. */
const APPEAR_MS = 520;

/**
 * La marque se pose à l'ouverture, pas à la fermeture. Un client qui repart par
 * la barre latérale sans rien cliquer a bien vu la fenêtre : la lui remontrer à
 * chaque passage sur l'onglet en ferait une porte à pousser.
 */
function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* stockage refusé : l'explication reviendra à la prochaine visite */
  }
}

const STEPS = ["step1", "step2", "step3"] as const;

export function StructureIntroModal({ domain }: { domain: string }) {
  const t = useTranslations("dashboard.structureIntro");
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Un navigateur qui refuse le stockage ne doit pas priver le client de
    // l'explication : on affiche, sans mémoire.
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    const timer = setTimeout(() => {
      setOpen(true);
      markSeen();
    }, APPEAR_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const release = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
      if (event.key === "ArrowRight") setStep((current) => Math.min(current + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((current) => Math.max(current - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    nextRef.current?.focus();
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    markSeen();
  }

  const last = step === STEPS.length - 1;
  const key = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          {/* Le voile. Cliquable : on referme une explication comme une porte,
              sans chercher le bouton. */}
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
            aria-label={t("eyebrow")}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
            transition={
              reduced ? { duration: 0 } : { type: "spring", stiffness: 230, damping: 26, mass: 0.9 }
            }
            className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-card border border-fog bg-snow p-3 shadow-[var(--shadow-md)] sm:p-4"
          >
            <StructureScene step={step} domain={domain} />

            <div className="px-2 pb-1 pt-5 sm:px-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
                {t("eyebrow")}
              </p>

              {/* La règle de progression. Trois segments, et la navigation avec :
                  revenir sur un temps lu ne mérite pas un bouton de plus. */}
              <div className="mt-3 flex gap-1.5">
                {STEPS.map((id, index) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStep(index)}
                    aria-label={t("stepAria", { n: index + 1 })}
                    aria-current={index === step ? "step" : undefined}
                    className="group h-1.5 flex-1 cursor-pointer rounded-pill bg-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
                  >
                    <motion.span
                      className="block h-full origin-left rounded-pill bg-obsidian"
                      initial={false}
                      animate={{ scaleX: index <= step ? 1 : 0 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
                    />
                  </button>
                ))}
              </div>

              <div className="min-h-[148px] sm:min-h-[140px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={key}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={reduced ? { duration: 0 } : { duration: 0.26, ease: "easeOut" }}
                  >
                    <h2 className="mt-4 text-lg font-semibold leading-snug text-text sm:text-xl">
                      {t(`${key}Title`)}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t(`${key}Body`)}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex items-center gap-3">
                {last ? null : (
                  <button
                    type="button"
                    onClick={dismiss}
                    className="cursor-pointer rounded-pill px-3 py-2 text-sm text-steel transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
                  >
                    {t("skip")}
                  </button>
                )}

                <button
                  ref={nextRef}
                  type="button"
                  onClick={() => (last ? dismiss() : setStep(step + 1))}
                  className="ml-auto cursor-pointer rounded-pill bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
                >
                  {last ? t("done") : t("next")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
