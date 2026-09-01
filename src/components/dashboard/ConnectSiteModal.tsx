"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { StackMark } from "@/components/StackMark";
import { AgentLinkPanel } from "@/components/dashboard/AgentLinkPanel";
import { MCP_FIRST_PROMPT } from "@/constants/mcp";
import type { DetectedStack } from "@/lib/geo/types";

/**
 * Le parcours « agents » : connecter l'agent IA du client à son compte.
 *
 * L'écran montre d'abord, sur les vrais manques du rapport, ce que les agents
 * vont corriger ; puis il donne la prise à installer. Le prompt à copier a
 * disparu d'ici — c'est `AgentLinkPanel` qui tient désormais l'exécution.
 */

const FIX_INTERVAL_MS = 900; // une correction affichée toutes les 0,9 s
const ROW_HEIGHT = 40; // hauteur d'une ligne du bandeau, en px

/**
 * Bandeau d'en-tête : la console des agents. Les lignes reprennent les manques
 * réellement relevés sur le site, et passent une à une en « corrigé » sous le
 * faisceau d'analyse. C'est la promesse du produit, jouée sur ses propres
 * données plutôt que sur une illustration générique.
 */
function AgentConsole({
  domain,
  issues,
}: {
  domain: string;
  issues: string[];
}) {
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
      <div
        className="relative mt-3"
        style={{ height: issues.length * ROW_HEIGHT }}
      >
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
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                {label}
              </span>
              <motion.span
                animate={{
                  backgroundColor: fixed
                    ? "rgba(17,180,140,0.18)"
                    : "rgba(255,255,255,0.08)",
                  color: fixed ? "#3ddcae" : "rgba(255,255,255,0.5)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
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

/**
 * Ce qu'on envoie au développeur quand le client ne pose pas les mains
 * lui-même : l'adresse de la prise, la phrase. Deux lignes qui tiennent dans un
 * SMS et qui suffisent à démarrer sans avoir accès au tableau de bord.
 *
 * On transmet l'adresse plutôt qu'une commande toute faite : le développeur
 * n'utilise pas forcément l'agent que le client a choisi dans la modale, et
 * une adresse de serveur MCP se branche partout. Sans clé créée, il n'y a rien
 * à transmettre — on le dit franchement plutôt que d'envoyer une ligne qui
 * échouera chez lui.
 */
function handoffText(domain: string, endpoint: string | null): string {
  const lines = [`Correctifs GEO à appliquer sur ${domain} (got_the_ref).`, ""];

  lines.push(
    endpoint
      ? `1. Branche cette prise MCP dans ton agent IA : ${endpoint}`
      : "1. Branche la prise MCP got_the_ref dans ton agent IA, avec l'adresse de connexion que je t'envoie à part.",
  );
  lines.push(`2. Demande-lui : « ${MCP_FIRST_PROMPT} »`);

  return lines.join("\n");
}

export function ConnectSiteModal({
  domain,
  stack,
  issues,
  locked = false,
  onClose,
}: {
  domain: string;
  stack: DetectedStack | null;
  /** Manques relevés dans le rapport, rejoués dans l'en-tête (3 au plus). */
  issues: string[];
  /**
   * Compte gratuit. La prise reste offerte — c'est le geste que le produit
   * vend, et le cacher reviendrait à ne pas le vendre. Ce qui change est ce que
   * l'agent recevra : le serveur ne lui sert que les chantiers ouverts, et le
   * panneau le dit en une ligne plutôt que sous un voile.
   */
  locked?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("analysisReport.solve.modal");
  const [shared, setShared] = useState(false);

  // L'adresse de la prise, quand le client vient de créer sa clé dans le
  // panneau. Elle remonte ici pour que la transmission au développeur porte la
  // vraie adresse plutôt qu'une consigne d'aller la chercher.
  const [endpoint, setEndpoint] = useState<string | null>(null);

  /**
   * Passer le travail au développeur, c'est lui passer l'installation — pas un
   * lien vers un écran auquel il n'a pas accès. Sur mobile, la feuille de
   * partage du système l'envoie où le client veut ; ailleurs, il n'y a rien à
   * ouvrir et la copie fait le même travail.
   */
  async function shareWithDeveloper() {
    const text = handoffText(domain, endpoint);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("shareDevTitle", { domain }), text });
        return;
      } catch {
        // Partage annulé ou refusé : on retombe sur la copie.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      window.setTimeout(() => setShared(false), 2600);
    } catch {
      /* presse-papiers indisponible : les commandes restent copiables à la main */
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
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
            {t("body")}
          </p>

          {stack && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-fog bg-mist px-3 py-1.5 text-xs text-text">
              <StackMark id={stack.id} size={14} className="text-steel" />
              {t("detected", { name: stack.name })}
            </p>
          )}

          {/* Le rattachement de l'agent : la seule chose à faire sur cet écran. */}
          <div className="mt-5">
            <AgentLinkPanel locked={locked} onEndpoint={setEndpoint} />
          </div>

          {/* La publication automatique sur le site arrive après. Le bouton
              reste à sa place, désactivé et daté : masquer l'étape à venir
              ferait croire qu'elle n'existe pas, et un bouton qui promet la
              connexion sans la faire coûte encore plus cher. */}
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              disabled
              aria-disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-fog bg-mist px-5 py-3 text-sm font-medium text-muted"
            >
              {t("cta")}
              <span className="rounded-full bg-obsidian/10 px-2 py-0.5 text-[11px] font-semibold text-graphite">
                {t("connectSoon")}
              </span>
            </button>

            <button
              type="button"
              onClick={shareWithDeveloper}
              className="cursor-pointer rounded-full border border-fog px-5 py-2.5 text-sm font-medium text-text transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {shared ? t("shareDevDone") : t("shareDev")}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {t("later")}
            </button>
          </div>

          <p className="mt-4 text-center text-xs leading-relaxed text-steel">
            {t("reassurance")}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
