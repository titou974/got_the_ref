"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { lockScroll } from "@/lib/scroll-lock";
import { Portal } from "@/components/Portal";

/**
 * La fenêtre de confirmation des décisions de publication.
 *
 * Publier et valider sont les deux seuls gestes du produit qui sortent du
 * tableau de bord : l'un dépose un texte sur le site du client, l'autre autorise
 * la file à le faire sans lui. Ils méritent une seconde où l'on annonce la
 * conséquence — la date, ou l'immédiat — avant de la déclencher.
 *
 * La fenêtre reprend le voile et le ressort du mot d'accueil : c'est la même
 * maison qui parle. Son bouton porte le verbe de celui qui l'a ouverte —
 * « Publier maintenant » ouvre une fenêtre dont le bouton dit « Publier
 * maintenant ». Un client ne doit jamais avoir à traduire d'un écran à l'autre.
 *
 * Sortie du flux par un portail : la barre d'action est en `position: fixed`,
 * et une fenêtre rendue dedans hériterait de son empilement.
 */
export function ConfirmDialog({
  open,
  eyebrow,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending = false,
  error = null,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  /** Le geste, en trois mots au-dessus du titre. */
  eyebrow: string;
  title: string;
  /** La conséquence, écrite en toutes lettres. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** Ce que la décision fait choisir en plus — la date de départ, au besoin. */
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const release = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[95] flex items-end justify-center p-4 sm:items-center sm:p-6">
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.24, ease: "easeOut" }}
              className="absolute inset-0 cursor-default bg-obsidian/25 backdrop-blur-[3px]"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
              transition={
                reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }
              }
              className="relative w-full max-w-md overflow-hidden rounded-card-compact border border-fog bg-snow shadow-[var(--shadow-md)]"
            >
              {/* Le liseré du quai, en tête de fenêtre : le même trait qui, sur
                  la page Articles, dit qu'un départ est armé. */}
              <span aria-hidden className="block h-1 w-full bg-obsidian" />

              <div className="p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
                  {eyebrow}
                </p>
                <h2 id={titleId} className="mt-2 text-xl font-semibold leading-snug text-text">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

                {children ? <div className="mt-4">{children}</div> : null}

                {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    ref={confirmRef}
                    type="button"
                    disabled={pending}
                    onClick={onConfirm}
                    className="cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:opacity-60"
                  >
                    {confirmLabel}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onClose}
                    className="cursor-pointer rounded-pill px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-mist hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:opacity-60"
                  >
                    {cancelLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
