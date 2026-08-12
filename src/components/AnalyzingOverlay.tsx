"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { lockScroll } from "@/lib/scroll-lock";

// Animations d'assets + 1 animation générée (emerald). L'étape « Scoring GEO »
// n'utilise pas de Lottie : elle affiche les logos IA animés (framer-motion).
import doc from "@/assets/animation1.json"; // document
import satellite from "@/assets/animation2.json"; // satellite + bulles
import search from "@/assets/animation3.json"; // loupe
import rocket from "@/assets/animation5.json"; // fusée
import citability from "@/lottie/citability.json"; // repli de l'étape citabilité

/**
 * Étape « citabilité » : animation riche servie depuis /public et récupérée au
 * montage de l'overlay, plutôt qu'importée. Elle pèse ~500 Ko : dans le bundle,
 * ce poids serait payé au premier chargement de la home, alors qu'elle ne sert
 * qu'une fois l'analyse lancée. Elle arrive donc pendant les deux premières
 * étapes, largement avant d'être affichée — et à défaut, le repli reste en place.
 */
const CITABILITY_ANIMATION_URL = "/lottie/ai-digital.json";

// lottie-react accède à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type Phase = {
  /** Clé i18n du libellé dans le namespace `analyzing` (phase<Key>). */
  labelKey:
    | "phaseDoc"
    | "phaseSatellite"
    | "phaseCitability"
    | "phaseLogos"
    | "phaseSearch"
    | "phaseRocket";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anim: any;
  key: string;
};

const PHASES: Phase[] = [
  { labelKey: "phaseDoc", anim: doc, key: "doc" },
  { labelKey: "phaseSatellite", anim: satellite, key: "satellite" },
  { labelKey: "phaseCitability", anim: citability, key: "citability" },
  { labelKey: "phaseLogos", anim: null, key: "logos" },
  { labelKey: "phaseSearch", anim: search, key: "search" },
  { labelKey: "phaseRocket", anim: rocket, key: "rocket" },
];

// Modèles IA interrogés (logos dans /public).
const LOGOS = [
  { src: "/logoopenai1.png", name: "ChatGPT" },
  { src: "/logoperplexity1.png", name: "Perplexity" },
  { src: "/logogemini1.webp", name: "Gemini" },
];

// Étape « Scoring GEO » : les 3 logos IA en grand, qui flottent et s'allument
// tour à tour (framer-motion). Tout en transform/opacity → fluide et léger.
function LogosShowcase({ activeLogo }: { activeLogo: number }) {
  const POS = [
    "left-1/2 top-0 -translate-x-1/2", // ChatGPT en haut
    "left-0 bottom-1", // Perplexity bas-gauche
    "right-0 bottom-1", // Gemini bas-droite
  ];
  return (
    <div className="relative h-full w-full">
      {LOGOS.map((logo, i) => {
        const isActive = activeLogo === i;
        return (
          <motion.div
            key={logo.name}
            className={`absolute ${POS[i]}`}
            animate={{ scale: isActive ? 1.15 : 0.82, opacity: isActive ? 1 : 0.4 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            style={{ willChange: "transform" }}
          >
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 2.5, 0, -2.5, 0] }}
              transition={{
                duration: 3 + i * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.5,
              }}
              style={{ willChange: "transform" }}
            >
              <div
                className="flex h-20 w-20 items-center justify-center rounded-[28px] border bg-snow p-3.5 sm:h-24 sm:w-24"
                style={{
                  borderColor: isActive
                    ? "var(--color-obsidian)"
                    : "var(--color-fog)",
                  boxShadow: isActive
                    ? "rgba(0,0,0,0.10) 0px 8px 24px 0px"
                    : "0 0 0 0 transparent",
                  transition: "box-shadow 0.55s ease, border-color 0.55s ease",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.src}
                  alt={logo.name}
                  width={72}
                  height={72}
                  loading="eager"
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function AnalyzingOverlay({
  domain,
  onComplete,
}: {
  domain: string;
  /** Appelé une fois que toutes les étapes ont défilé (faux temps écoulé). */
  onComplete?: () => void;
}) {
  const t = useTranslations("analyzing");
  // Faux temps : une durée « organique » par étape, figée au montage (client).
  const durations = useState<number[]>(() =>
    PHASES.map((p) =>
      // L'étape des logos IA dure un peu plus pour laisser défiler l'allumage.
      p.key === "logos"
        ? 3000 + Math.round(Math.random() * 900)
        : 1200 + Math.round(Math.random() * 1100),
    ),
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
  const [activeLogo, setActiveLogo] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [citabilityAnim, setCitabilityAnim] = useState<any>(null);

  // Animation de l'étape citabilité : récupérée en tâche de fond dès le montage.
  useEffect(() => {
    let alive = true;
    fetch(CITABILITY_ANIMATION_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) setCitabilityAnim(data);
      })
      .catch(() => {
        /* animation indisponible : le repli importé reste affiché */
      });
    return () => {
      alive = false;
    };
  }, []);

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
        if (cur < PHASES.length - 1) {
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

  // Projecteur qui passe d'un logo IA à l'autre.
  useEffect(() => {
    const id = setInterval(() => {
      setActiveLogo((a) => (a + 1) % LOGOS.length);
    }, 750);
    return () => clearInterval(id);
  }, []);

  // Verrouille le scroll de la page pendant l'analyse (verrou partagé : la
  // modale Maps peut encore être en cours de sortie quand l'overlay se monte).
  useEffect(() => lockScroll(), []);

  const phase = PHASES[step];
  const phaseAnim = phase.key === "citability" ? citabilityAnim ?? phase.anim : phase.anim;
  const overall = Math.min(100, ((prefix[step] + elapsed) / totalMs) * 100);
  const stepSeconds = (elapsed / 1000).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center bg-bg"
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

      {/* Animation centrale (fondu à chaque changement d'étape) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5">
        <div className="flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase.key}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="h-full w-full"
            >
              {phase.key === "logos" ? (
                <LogosShowcase activeLogo={activeLogo} />
              ) : (
                <Lottie animationData={phaseAnim} loop autoplay className="h-full w-full" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Libellé d'étape + faux temps */}
        <div className="mt-2 flex h-7 items-center justify-center gap-2 sm:mt-4">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-center text-sm text-muted sm:text-base"
            >
              {t(phase.labelKey)}
            </motion.p>
          </AnimatePresence>
          <span className="rounded-full bg-fog px-2 py-0.5 font-mono text-[0.7rem] tabular-nums text-steel">
            {stepSeconds}s
          </span>
        </div>

        {/* Barre de progression continue */}
        <div className="mt-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-fog">
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
