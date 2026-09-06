"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { lockScroll } from "@/lib/scroll-lock";
import { ROUTES } from "@/constants/routes";

/**
 * La marque du client, au pied du rail de l'atelier : sa couleur, puis son ton.
 *
 * C'est sous ces deux-là que l'article a été écrit, et sous elles qu'on le
 * relit : elles se lisent pendant la lecture, pas à deux écrans de là. Elles
 * prennent la place de la carte de citabilité, qui occupait ce pied de rail :
 * la mesure y répétait en gros ce que les entrées du plan signalent déjà,
 * section par section, tandis que la voix ne se lisait nulle part.
 *
 * Les deux cartes tiennent en hauteur fixe, et le rail ne défile plus autour
 * d'elles : le plan seul défile, au-dessus. Un pied qu'il faut aller chercher
 * en faisant défiler la colonne n'est plus un pied, et le relevé fait six
 * phrases — de quoi remplir la colonne entière. Le ton est donc coupé à deux
 * lignes, et le clic donne le reste dans une modale.
 *
 * Les cartes ne sont montées que là où le ton sert — démo, abonnement, Coup de
 * Boost : ce sont les offres qui font écrire des textes au nom du client. Un
 * compte gratuit ne les voit pas, la page ne les lui passe pas.
 */
export function BrandToneCard({
  tone,
  voice,
}: {
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
  voice: { instructions: string; banned: string[] } | null;
}) {
  const t = useTranslations("dashboard.article.tone");
  const c = useTranslations("dashboard.article.brandColor");
  const [open, setOpen] = useState(false);

  return (
    <div className="shrink-0 space-y-2">
      {/* La couleur, dans son propre carré. Elle tenait un filet le long du ton :
          un trait de trois pixels ne montre pas une couleur, il la signale. */}
      <div className="flex items-center gap-3 rounded-2xl border border-border px-3.5 py-2.5">
        <span
          aria-hidden
          className="size-7 shrink-0 rounded-lg border border-border"
          style={{ background: tone.color ?? "var(--color-mist)" }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-steel">
            {c("title")}
          </span>
          <span className="block text-[13px] tabular-nums text-text">
            {tone.color ?? c("empty")}
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group w-full cursor-pointer rounded-2xl border border-border px-3.5 py-2.5 text-left transition-colors duration-200 hover:border-graphite"
      >
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-steel">
          {t("title")}
        </span>

        {tone.summary ? (
          /* Deux lignes, pas une de plus : `line-clamp` pose lui-même son
             `display`, et lui adjoindre `block` annulait la coupe — le relevé
             entier s'affichait alors dans le rail. */
          <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate">
            {tone.summary}
          </span>
        ) : (
          <span className="mt-1 line-clamp-2 text-xs italic leading-relaxed text-muted">
            {t("detectedEmpty")}
          </span>
        )}

        <span className="mt-1.5 block text-[11px] text-ash transition-colors duration-200 group-hover:text-text">
          {t("readAll")}
        </span>
      </button>

      <BrandToneDialog open={open} onClose={() => setOpen(false)} tone={tone} voice={voice} />
    </div>
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
                {/* Le lien tombe sur la section « ton » des réglages, où le
                    relevé s'amende dans un champ : y arriver en haut d'une page
                    qui n'en montrait qu'une copie en lecture seule était une
                    porte fermée. */}
                <Link
                  href={ROUTES.dashboardSettingsTone}
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
