"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { lockScroll } from "@/lib/scroll-lock";
import { ArticleFlowScene } from "./article/ArticleFlowScene";

/**
 * La marche à suivre, à la première arrivée sur les articles.
 *
 * Un compte qui vient de payer ouvre cet onglet et voit un calendrier de sujets.
 * Rien n'y dit ce qu'on attend de lui, ni dans quel ordre : le site se rattache
 * d'abord, les articles se relisent ensuite, et le départ se fait tout seul à la
 * fin. Trois gestes, un seul ordre possible, et c'est ce que la fenêtre montre.
 *
 * Elle ne s'ouvre que pour les offres qui ouvrent la rédaction. Un compte
 * gratuit n'a pas de site à rattacher ni d'article à valider : lui expliquer la
 * chaîne avant qu'il puisse l'utiliser reviendrait à vendre pendant qu'il
 * cherche autre chose.
 *
 * Une seule fois, retenue dans le navigateur, comme le mot de bienvenue du
 * tableau de bord. Le pas courant se lit dans la règle de progression en tête du
 * texte, qui sert aussi de navigation : les trois segments se cliquent.
 *
 * L'animation du haut n'est pas décorative. C'est l'atelier d'article en
 * miniature — rail de sommaire, feuille, pilule de décision — et il reste en
 * place d'une étape à l'autre pendant que son état change. Le client reconnaît
 * l'écran avant de l'ouvrir.
 */
const SEEN_KEY = "gotref:articles-intro:v1";

/** Le temps que la page se pose avant que le calque ne monte. */
const APPEAR_MS = 520;

const STEPS = ["step1", "step2", "step3"] as const;

export function ArticlesIntroModal() {
  const t = useTranslations("dashboard.articlesIntro");
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Un navigateur qui refuse le stockage ne doit pas priver le client de la
    // marche à suivre : on affiche, sans mémoire.
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
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* stockage refusé : la marche à suivre reviendra à la prochaine visite */
    }
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
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 230, damping: 26, mass: 0.9 }
            }
            className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-card border border-fog bg-snow p-3 shadow-[var(--shadow-md)] sm:p-4"
          >
            <ArticleFlowScene step={step} sheetTitle={t("sheetTitle")} />

            <div className="px-2 pb-1 pt-5 sm:px-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
                {t("eyebrow")}
              </p>

              {/* La règle de progression. Trois segments, et la navigation avec :
                  revenir sur une étape lue ne mérite pas un bouton de plus. */}
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

              <div className="min-h-[112px] sm:min-h-[104px]">
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
