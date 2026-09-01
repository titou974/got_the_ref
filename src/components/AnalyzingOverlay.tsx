"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { AiKeysAnimation } from "@/components/AiKeysAnimation";
import { useNicheQuestions } from "@/components/useNicheQuestions";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import type { BusinessMode } from "@/lib/geo/types";

/**
 * L'attente de l'analyse gratuite, lancée depuis la page d'accueil.
 *
 * Au centre, le clavier : la question qu'un client taperait s'écrit lettre à
 * lettre dans ChatGPT, puis Perplexity, puis Gemini. C'est exactement ce que
 * l'analyse est en train de faire, et c'est le seul moment où le visiteur
 * regarde l'écran sans rien avoir d'autre à faire — autant lui montrer le
 * produit plutôt qu'un décor.
 *
 * Il a remplacé une suite d'animations Lottie qui tournaient là. Elles étaient
 * jolies et ne disaient rien : une fusée, un satellite et une loupe illustrent
 * « ça charge », pas « on pose vos questions à trois moteurs ». Elles pesaient
 * en plus un demi-mégaoctet chargé depuis la page d'accueil, pour une image que
 * personne ne revoit ensuite.
 *
 * Les questions elles-mêmes sont écrites pour le site analysé (niche déduite du
 * domaine par DeepSeek Flash, cf. `/api/analyze/questions`). Elles arrivent en
 * cours de route : le clavier commence sur des questions d'attente et bascule
 * dès que la réponse tombe.
 *
 * Le découpage en étapes reste : c'est lui qui donne la barre de progression et
 * le faux temps, et surtout c'est lui qui décide quand l'écran a « fini » —
 * `onComplete` est ce que la page attend pour rediriger.
 */

/** Les étapes annoncées, dans l'ordre. Clés i18n du namespace `analyzing`. */
const PHASE_KEYS = [
  "phaseDoc",
  "phaseSatellite",
  "phaseCitability",
  "phaseLogos",
  "phaseSearch",
  "phaseRocket",
] as const;

type PhaseKey = (typeof PHASE_KEYS)[number];

export function AnalyzingOverlay({
  domain,
  url,
  mode = "physical",
  onComplete,
}: {
  domain: string;
  /** L'adresse saisie, telle quelle : sert à faire déduire la niche. */
  url?: string;
  mode?: BusinessMode;
  /** Appelé une fois que toutes les étapes ont défilé (faux temps écoulé). */
  onComplete?: () => void;
}) {
  const t = useTranslations("analyzing");

  // Faux temps : une durée « organique » par étape, figée au montage (client).
  const durations = useState<number[]>(() =>
    PHASE_KEYS.map(() => 1600 + Math.round(Math.random() * 1400)),
  )[0];

  // Sommes préfixes pour une progression continue et fluide.
  const prefix = useMemo(() => {
    const p = [0];
    for (const d of durations) p.push(p[p.length - 1] + d);
    return p;
  }, [durations]);
  const totalMs = prefix[prefix.length - 1];

  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0); // ms écoulées dans l'étape courante

  // Les questions écrites pour ce site. Tant qu'elles ne sont pas là, le
  // clavier tape ses questions d'attente — il ne reste jamais immobile.
  const { questions, niche } = useNicheQuestions(url, mode);

  // Horloge des étapes : avance le step et tient à jour le faux temps (~10 fps).
  const stepRef = useRef(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  // Le callback est stocké dans un ref hors rendu, pour que l'horloge n'ait pas
  // à redémarrer quand le parent en recrée une nouvelle référence.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let startedAt = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const cur = stepRef.current;
      let e = now - startedAt;
      if (e >= durations[cur]) {
        if (cur < PHASE_KEYS.length - 1) {
          stepRef.current = cur + 1;
          startedAt = now;
          setStep(cur + 1);
          e = 0;
        } else {
          // Dernière étape terminée → on signale la fin une seule fois.
          e = durations[cur];
          if (!doneRef.current) {
            doneRef.current = true;
            onCompleteRef.current?.();
          }
        }
      }
      setElapsed(Math.min(e, durations[stepRef.current]));
    }, 100);
    return () => clearInterval(id);
  }, [durations]);

  // Verrouille le scroll de la page pendant l'analyse.
  useBodyScrollLock();

  const phase: PhaseKey = PHASE_KEYS[step];
  const overall = Math.min(100, ((prefix[step] + elapsed) / totalMs) * 100);
  const stepSeconds = (elapsed / 1000).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-bg"
      role="status"
      aria-live="polite"
    >
      {/* Halo d'ambiance discret */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 42%, color-mix(in oklch, var(--color-accent) 12%, transparent), transparent 70%)",
        }}
      />

      {/* Titre en haut : site analysé */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="relative z-10 w-full px-5 pt-10 text-center sm:pt-14"
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-steel">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-xl font-semibold sm:text-2xl">{domain}</h1>
      </motion.header>

      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-5 py-8">
        {/* Le clavier : les trois moteurs, la barre de recherche, la frappe. */}
        <div className="w-full max-w-xl">
          <AiKeysAnimation questions={questions} niche={niche} />
        </div>

        {/* Libellé d'étape + faux temps */}
        <div className="mt-5 flex h-7 items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-center text-sm text-muted sm:text-base"
            >
              {t(phase)}
            </motion.p>
          </AnimatePresence>
          <span className="rounded-full bg-fog px-2 py-0.5 font-mono text-[0.7rem] tabular-nums text-steel">
            {stepSeconds}s
          </span>
        </div>

        {/* Barre de progression continue */}
        <div className="mt-5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-fog">
          <motion.div
            className="h-full rounded-full bg-obsidian"
            animate={{ width: `${overall}%` }}
            transition={{ ease: "linear", duration: 0.12 }}
          />
        </div>
      </div>

      {/* Note de réassurance discrète */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-10 w-full px-5 pb-10 text-center sm:pb-14"
      >
        <p className="text-xs text-muted/70">{t("wait")}</p>
      </motion.footer>
    </motion.div>
  );
}
