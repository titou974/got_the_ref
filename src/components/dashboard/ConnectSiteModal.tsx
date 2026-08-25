"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { StackMark } from "@/components/StackMark";
import type { DetectedStack } from "@/lib/geo/types";

/**
 * Première étape du parcours « agents » : connecter le site. La logique de
 * connexion et de résolution viendra ensuite — cet écran pose l'intention et
 * montre, sur les vrais manques du rapport, ce que les agents vont corriger.
 */

const FIX_INTERVAL_MS = 900; // une correction affichée toutes les 0,9 s
const ROW_HEIGHT = 40; // hauteur d'une ligne du bandeau, en px

/**
 * Bandeau d'en-tête : la console des agents. Les lignes reprennent les manques
 * réellement relevés sur le site, et passent une à une en « corrigé » sous le
 * faisceau d'analyse. C'est la promesse du produit, jouée sur ses propres
 * données plutôt que sur une illustration générique.
 */
function AgentConsole({ domain, issues }: { domain: string; issues: string[] }) {
  const t = useTranslations("analysisReport.solve.modal");
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? issues.length : 0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      // Après la dernière ligne, une respiration puis on rejoue la séquence.
      setStep((s) => (s > issues.length ? 0 : s + 1));
    }, FIX_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduced, issues.length]);

  const fixedCount = Math.min(step, issues.length);

  return (
    <div className="relative overflow-hidden rounded-t-[28px] bg-obsidian px-5 pb-5 pt-4">
      {/* Barre de fenêtre : même grammaire que la capture du site dans le rapport. */}
      <div className="flex items-center gap-2.5">
        <span className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">
          {domain}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
          {t("fixedCount", { count: fixedCount, total: issues.length })}
        </span>
      </div>

      {/* Lignes de correction + faisceau qui les balaie. */}
      <div className="relative mt-3" style={{ height: issues.length * ROW_HEIGHT }}>
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(17,180,140,0.9), transparent)",
            }}
            animate={{ y: [0, issues.length * ROW_HEIGHT] }}
            transition={{
              duration: (issues.length * FIX_INTERVAL_MS) / 1000,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {issues.map((label, i) => {
          const fixed = i < fixedCount;
          return (
            <div
              key={label}
              className="flex items-center justify-between gap-3 border-b border-white/10 last:border-0"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">{label}</span>
              <motion.span
                animate={{
                  backgroundColor: fixed ? "rgba(17,180,140,0.18)" : "rgba(255,255,255,0.08)",
                  color: fixed ? "#3ddcae" : "rgba(255,255,255,0.5)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                  {fixed ? (
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                {fixed ? t("statusFixed") : t("statusPending")}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConnectSiteModal({
  domain,
  stack,
  issues,
  solutionPrompt,
  onClose,
}: {
  domain: string;
  stack: DetectedStack | null;
  /** Manques relevés dans le rapport, rejoués dans l'en-tête (3 au plus). */
  issues: string[];
  /** Le prompt de correction, seule action réellement disponible aujourd'hui. */
  solutionPrompt: string;
  onClose: () => void;
}) {
  const t = useTranslations("analysisReport.solve.modal");
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(solutionPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : rien à signaler, le bouton ne change pas */
    }
  }

  // Échap ferme la modale ; verrou du scroll tant qu'elle est ouverte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute inset-0 bg-obsidian/45 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-site-title"
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-[28px] border border-fog bg-snow shadow-[var(--shadow-md)]"
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 22, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        <AgentConsole domain={domain} issues={issues} />

        <div className="p-6 sm:p-7">
          <h2 id="connect-site-title" className="text-xl font-bold text-text">
            {t("title")}
          </h2>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">{t("body")}</p>

          {stack && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-fog bg-mist px-3 py-1.5 text-xs text-text">
              <StackMark id={stack.id} size={14} className="text-steel" />
              {t("detected", { name: stack.name })}
            </p>
          )}

          {/* Le rattachement automatique arrive ; d'ici là, le prompt fait le
              travail. Un bouton qui promet la connexion sans la faire coûte
              plus cher en confiance que l'aveu du calendrier. */}
          <p className="mt-4 rounded-2xl border border-fog bg-mist px-4 py-3 text-xs leading-relaxed text-muted">
            {t("soonNote")}
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              autoFocus
              onClick={copyPrompt}
              className="cursor-pointer rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {copied ? t("promptCopied") : t("promptCta")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {t("later")}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-muted/80">{t("reassurance")}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
