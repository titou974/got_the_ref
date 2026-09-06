"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { lockScroll } from "@/lib/scroll-lock";
import { ROUTES } from "@/constants/routes";

/**
 * Le ton de la marque, au pied du rail de l'atelier.
 *
 * C'est la contrainte sous laquelle l'article a été écrit, et celle sous
 * laquelle on le relit : elle se lit pendant la lecture, pas à deux écrans de
 * là. Elle prend la place de la carte de citabilité, qui occupait ce pied de
 * rail : la mesure y répétait en gros ce que les entrées du plan signalent
 * déjà, section par section, tandis que la voix ne se lisait nulle part.
 *
 * Deux lignes seulement, et le reste dans une modale. Le relevé fait six
 * phrases — de quoi remplir la colonne entière et pousser le plan hors de
 * l'écran ; deux lignes suffisent à reconnaître sa propre voix, et le clic
 * donne le reste quand on veut le vérifier.
 *
 * Le filet de gauche est peint à la couleur relevée sur le site du client. Le
 * rail emploie déjà ce trait, plus haut, pour marquer la section où l'on écrit ;
 * ici il ne marque rien, il porte la couleur — c'est le seul endroit de l'écran
 * qui appartienne au client plutôt qu'au produit.
 *
 * La carte n'est montée que là où le ton sert — démo, abonnement, Coup de
 * Boost : ce sont les offres qui font écrire des textes au nom du client. Un
 * compte gratuit ne la voit pas, la page ne la lui passe pas.
 */
export function BrandToneCard({
  tone,
  voice,
}: {
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
  voice: { instructions: string; banned: string[] } | null;
}) {
  const t = useTranslations("dashboard.article.tone");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group relative shrink-0 cursor-pointer overflow-hidden rounded-3xl border border-border p-4 pl-5 text-left transition-colors duration-200 hover:border-graphite"
      >
        {/* Le filet de la marque, à même le bord de la carte. Il retombe sur le
            gris des liserés quand la couleur n'a pas pu être relevée : un trait
            absent creuserait un décalage dans la carte. */}
        <span
          aria-hidden
          className="absolute inset-y-4 left-0 w-[3px] rounded-pill"
          style={{ background: tone.color ?? "var(--color-pebble)" }}
        />

        <span className="block text-[11px] font-semibold uppercase tracking-wider text-steel">
          {t("title")}
        </span>

        {tone.summary ? (
          <span className="mt-1.5 block line-clamp-2 text-xs leading-relaxed text-slate">
            {tone.summary}
          </span>
        ) : (
          <span className="mt-1.5 block text-xs italic leading-relaxed text-muted">
            {t("detectedEmpty")}
          </span>
        )}

        <span className="mt-2 block text-[11px] text-ash transition-colors duration-200 group-hover:text-text">
          {t("readAll")}
        </span>
      </button>

      <BrandToneDialog
        open={open}
        onClose={() => setOpen(false)}
        tone={tone}
        voice={voice}
      />
    </>
  );
}

/**
 * Le relevé en entier, par-dessus l'atelier.
 *
 * Le texte y est composé dans la serif du document, et non dans la sans de
 * l'interface : ce qu'on lit est une manière d'écrire, et elle se montre dans la
 * forme où l'article se lira. Les consignes du client gardent la sans — elles
 * corrigent le relevé, elles n'en font pas partie, et les mélanger dans la même
 * fonte les aurait fait passer pour une seule voix.
 */
function BrandToneDialog({
  open,
  onClose,
  tone,
  voice,
}: {
  open: boolean;
  onClose: () => void;
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
  voice: { instructions: string; banned: string[] } | null;
}) {
  const t = useTranslations("dashboard.article.tone");
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const release = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          {/* Le voile se clique : on referme un relevé qu'on est venu vérifier
              comme on repose une feuille, sans chercher de bouton. */}
          <motion.button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 cursor-pointer bg-obsidian/30"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-[36px] bg-snow shadow-[rgba(0,0,0,0.18)_0_18px_60px]"
          >
            {/* La couleur du client tient toute la largeur, une fois, en tête :
                c'est sa marque qui ouvre la fiche de sa voix. */}
            <span
              aria-hidden
              className="h-1.5 w-full shrink-0"
              style={{ background: tone.color ?? "var(--color-pebble)" }}
            />

            <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8">
              <div className="min-w-0">
                <h2 className="text-[20px] font-semibold leading-tight text-obsidian">
                  {t("title")}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-steel">{t("hint")}</p>
              </div>

              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="shrink-0 cursor-pointer rounded-pill border border-border px-3 py-1.5 text-[13px] text-slate transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/30"
              >
                {t("close")}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
              {tone.summary ? (
                <p className="article-voice whitespace-pre-line">{tone.summary}</p>
              ) : (
                <p className="text-sm italic leading-relaxed text-muted">{t("detectedEmpty")}</p>
              )}

              {/* Les consignes passent après le relevé : elles le corrigent,
                  elles ne le remplacent pas. */}
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">
                  {t("instructions")}
                </p>
                {voice?.instructions ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-text">{voice.instructions}</p>
                ) : (
                  <p className="mt-1.5 text-sm italic leading-relaxed text-muted">
                    {t("instructionsEmpty")}
                  </p>
                )}
                {voice?.banned.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {voice.banned.map((word) => (
                      <span
                        key={word}
                        className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link
                  href={ROUTES.dashboardSettings}
                  className="cursor-pointer text-[13px] font-medium text-text underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:decoration-obsidian"
                >
                  {t("edit")}
                </Link>
                {tone.sampleUrl ? (
                  <a
                    href={tone.sampleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer text-[13px] text-steel underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:decoration-obsidian"
                  >
                    {t("sample")}
                  </a>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
