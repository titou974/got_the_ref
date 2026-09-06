"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAction } from "next-safe-action/hooks";
import { RiMapPin2Fill } from "@remixicon/react";
import { refreshMapsPlaceAction, saveMapsUrlAction } from "@/features/dashboard/actions";
import { lockScroll } from "@/lib/scroll-lock";
import { Portal } from "@/components/Portal";
import { MapsSkeleton } from "./MapsSkeleton";

/**
 * Ce qui se passe avant que la page ait quelque chose à montrer.
 *
 * Un commerce qui reçoit du public peut arriver ici sans fiche : le champ était
 * facultatif pendant l'accueil, et beaucoup l'ont sauté. La page ne peut alors
 * rien afficher — pas d'avis, pas de textes, pas de cases. Plutôt qu'un écran
 * vide qui renvoie aux réglages, on demande le lien tout de suite, dans une
 * fenêtre, et le relevé part dès qu'il est donné.
 *
 * Le calque se ferme à la seconde où le lien est accepté : ce qui suit — une
 * minute chez Google — se regarde sur la page elle-même, en squelette. Faire
 * attendre derrière un voile, c'est faire attendre devant une porte fermée.
 *
 * Trois états, un seul composant, parce qu'ils s'enchaînent : pas de lien, lien
 * mais pas de relevé, relevé. Les répartir sur trois écrans ferait perdre le
 * fil à celui qui les traverse en une minute.
 */

const APPEAR_MS = 320;

export function MapsGate({
  hasUrl,
  hasPlace,
  /**
   * Le relevé peut partir : l'offre l'ouvre, ou c'est le premier — celui qui est
   * accordé à un compte gratuit (cf. `canFetchPlace`). Faux, on ne demande rien
   * qu'on ne saurait relever.
   */
  canFetch,
  children,
}: {
  hasUrl: boolean;
  hasPlace: boolean;
  canFetch: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();

  const sync = useAction(refreshMapsPlaceAction, {
    // Le squelette ne tombe qu'une fois la page redemandée au serveur : la
    // relâcher à la réponse du relevé montrerait un écran vide entre les deux.
    onSuccess: () =>
      startRefresh(() => {
        router.refresh();
        setRunning(false);
      }),
    onError: () => setRunning(false),
  });

  const save = useAction(saveMapsUrlAction, {
    onSuccess: () => {
      setOpen(false);
      setRunning(true);
      sync.execute({ force: false });
    },
  });

  // La fenêtre monte une fois la page posée : ouverte à la milliseconde zéro,
  // elle passerait pour un défaut d'affichage plutôt que pour une question.
  useEffect(() => {
    if (hasUrl || !canFetch) return;
    const timer = setTimeout(() => setOpen(true), APPEAR_MS);
    return () => clearTimeout(timer);
  }, [hasUrl, canFetch]);

  const working = running || sync.isPending || isRefreshing;

  if (working) {
    return <MapsSkeleton step="Relevé de votre fiche chez Google, une minute environ." />;
  }

  return (
    <>
      {hasPlace ? (
        children
      ) : (
        <FirstRun
          hasUrl={hasUrl}
          canFetch={canFetch}
          error={sync.result.serverError ?? null}
          onAskLink={() => setOpen(true)}
          onSync={() => {
            setRunning(true);
            sync.execute({ force: false });
          }}
        />
      )}

      <LinkDialog
        open={open}
        pending={save.isPending}
        error={save.result.serverError ?? save.result.validationErrors?.mapsUrl?._errors?.[0] ?? null}
        onSubmit={(mapsUrl) => save.execute({ mapsUrl })}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * L'écran d'avant : la page existe, mais elle n'a encore rien de Google.
 *
 * Une seule phrase, un seul bouton. La cause change — pas de lien, ou pas de
 * relevé — le geste, lui, reste unique : donner de quoi remplir la page.
 */
function FirstRun({
  hasUrl,
  canFetch,
  error,
  onAskLink,
  onSync,
}: {
  hasUrl: boolean;
  canFetch: boolean;
  error: string | null;
  onAskLink: () => void;
  onSync: () => void;
}) {
  return (
    <section className="rounded-card border border-border bg-surface px-6 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-icon bg-mist">
        <RiMapPin2Fill size={22} className="text-graphite" />
      </span>

      <h2 className="mt-5 text-xl font-semibold">
        {hasUrl ? "Votre fiche n'a jamais été relevée" : "Nous n'avons pas encore votre fiche"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {hasUrl
          ? "Lancez le premier relevé : Google répond en une minute environ, et votre fiche s'affiche ici telle qu'il la montre — photos, horaires, avis compris."
          : "Collez le lien de votre fiche Google Maps. C'est elle que nous relevons chez Google, avec vos photos, vos horaires et vos avis."}
      </p>

      {canFetch ? (
        <button
          type="button"
          onClick={hasUrl ? onSync : onAskLink}
          className="mt-6 cursor-pointer rounded-pill bg-obsidian px-5 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
        >
          {hasUrl ? "Relever ma fiche" : "Ajouter ma fiche"}
        </button>
      ) : null}

      {error ? <p className="mx-auto mt-4 max-w-md text-sm text-danger">{error}</p> : null}
    </section>
  );
}

/**
 * La question, en une fenêtre.
 *
 * Le chemin du lien est écrit au-dessus du champ, dans l'ordre où on le suit
 * sur un téléphone. C'est la même numérotation que l'échelle des gestes de la
 * page : ici comme là, un chiffre veut dire un ordre de passage, jamais une
 * décoration.
 */
function LinkDialog({
  open,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (mapsUrl: string) => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    const release = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending, onClose]);

  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[95] flex items-end justify-center p-4 sm:items-center sm:p-6">
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => (pending ? undefined : onClose())}
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
              <span aria-hidden className="block h-1 w-full bg-obsidian" />

              <form
                className="p-5 sm:p-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!pending) onSubmit(value.trim());
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
                  Votre fiche Google
                </p>
                <h2 id={titleId} className="mt-2 text-xl font-semibold leading-snug">
                  Où se trouve votre fiche Google Maps ?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Collez son lien : nous la relevons chez Google et l'analyse démarre dans la
                  foulée. Une minute, et cette page se remplit.
                </p>

                <ol className="mt-4 space-y-1.5">
                  {[
                    "Ouvrez votre fiche dans Google Maps",
                    "Touchez « Partager »",
                    "Copiez le lien, collez-le ci-dessous",
                  ].map((step, index) => (
                    <li key={step} className="flex items-center gap-2.5 text-[13px] text-muted">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mist text-[11px] font-bold tabular-nums text-graphite">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>

                <input
                  ref={inputRef}
                  name="mapsUrl"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://maps.app.goo.gl/…"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={pending}
                  className={`mt-4 w-full rounded-xl border bg-surface px-3.5 py-3 text-base text-text placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-obsidian/25 disabled:bg-mist sm:text-sm ${
                    error ? "border-danger" : "border-border focus:border-obsidian"
                  }`}
                />

                {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={pending || value.trim().length < 4}
                    className="cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? "Enregistrement…" : "Analyser ma fiche"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onClose}
                    className="cursor-pointer rounded-pill px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-mist hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:opacity-60"
                  >
                    Plus tard
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
