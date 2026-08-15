"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import Image from "next/image";

type EngineKey = "chatgpt" | "gemini";

type Scenario = {
  engine: EngineKey;
  query: string;
  /** Concurrents fictifs affichés après « Votre entreprise » (donnée de démo). */
  competitors: string[];
};

const SCENARIOS: Scenario[] = [
  {
    engine: "chatgpt",
    query: "quelle agence web choisir à Bordeaux ?",
    competitors: ["Studio Pixel", "WebFactory Bordeaux"],
  },
  {
    engine: "gemini",
    query: "boutique de décoration tendance près de moi",
    competitors: ["Maison & Objet", "Atelier Déco"],
  },
];

/**
 * La conversation se déroule comme dans les vrais produits :
 * saisie dans le composer → envoi en bulle → réflexion → réponse en streaming.
 */
type Phase = "typing" | "thinking" | "streaming" | "results";

const TYPE_MS = 48;
const STREAM_MS = 55;

/* ------------------------------- Gemini ---------------------------------- */

const GEMINI_GRADIENT =
  "linear-gradient(90deg, #4285f4 0%, #9b72cb 52%, #d96570 100%)";

/** Étoile à 4 branches signature de Gemini — tourne pendant la génération. */
function GeminiSparkle({
  size = 16,
  spinning = false,
}: {
  size?: number;
  spinning?: boolean;
}) {
  const gradId = useId();
  const reduceMotion = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      animate={
        spinning && !reduceMotion
          ? { rotate: 360, scale: [1, 0.85, 1] }
          : { rotate: 0, scale: 1 }
      }
      transition={
        spinning && !reduceMotion
          ? {
              rotate: { repeat: Infinity, duration: 2.6, ease: "linear" },
              scale: { repeat: Infinity, duration: 1.3, ease: "easeInOut" },
            }
          : { duration: 0.2 }
      }
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4285f4" />
          <stop offset="55%" stopColor="#9b72cb" />
          <stop offset="100%" stopColor="#d96570" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.9 5.3 4.7 9.1 10 10-5.3.9-9.1 4.7-10 10-.9-5.3-4.7-9.1-10-10 5.3-.9 9.1-4.7 10-10Z"
        fill={`url(#${gradId})`}
      />
    </motion.svg>
  );
}

/* ------------------------------ Icônes UI -------------------------------- */

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Bulles d'onde du mode vocal ChatGPT — la pastille noire du composer. */
function WaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4M9 7v10M14 4v16M19 9v6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m14.5 11.5 6.3-6.3a1.6 1.6 0 0 0-2.3-2.3l-6.3 6.3-.7 3 3-.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

export function AiSearchSimulation() {
  const t = useTranslations("aiSimulation");
  const reduceMotion = useReducedMotion();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");
  const [wordCount, setWordCount] = useState(0);

  const scenario = SCENARIOS[scenarioIdx];
  const isChatgpt = scenario.engine === "chatgpt";
  const fullQuery = scenario.query;
  const results = [t("yourBusiness"), ...scenario.competitors];
  const introWords = useMemo(() => t("recommendIntro").split(" "), [t]);

  // Saisie dans le composer, caractère par caractère
  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length < fullQuery.length) {
      const id = setTimeout(
        () => setTyped(fullQuery.slice(0, typed.length + 1)),
        TYPE_MS,
      );
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase("thinking"), 450);
    return () => clearTimeout(id);
  }, [phase, typed, fullQuery]);

  // Réflexion → streaming de la réponse
  useEffect(() => {
    if (phase !== "thinking") return;
    const id = setTimeout(() => setPhase("streaming"), 1500);
    return () => clearTimeout(id);
  }, [phase]);

  // Streaming mot à mot de l'intro
  useEffect(() => {
    if (phase !== "streaming") return;
    if (wordCount < introWords.length) {
      const id = setTimeout(() => setWordCount((c) => c + 1), STREAM_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase("results"), 250);
    return () => clearTimeout(id);
  }, [phase, wordCount, introWords.length]);

  // Résultats affichés → scénario suivant
  useEffect(() => {
    if (phase !== "results") return;
    const id = setTimeout(() => {
      setTyped("");
      setWordCount(0);
      setPhase("typing");
      setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
    }, 3800);
    return () => clearTimeout(id);
  }, [phase]);

  const streaming = phase === "streaming";
  const sent = phase !== "typing";
  const composerText = phase === "typing" ? typed : "";
  const placeholder = t(isChatgpt ? "chatgptPlaceholder" : "geminiPlaceholder");

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-fog bg-snow shadow-[var(--shadow-md)]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={scenarioIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
        >
          {/* ----- Chrome du produit (barre de titre fidèle à chaque IA) ----- */}
          {isChatgpt ? (
            <div className="flex h-11 items-center justify-between border-b border-fog px-4">
              <span className="flex items-center gap-1 text-sm font-semibold text-[#0d0d0d]">
                ChatGPT
                <span className="font-normal text-muted">5</span>
                <span className="text-muted">
                  <ChevronDown />
                </span>
              </span>
              <span className="text-muted">
                <ComposeIcon />
              </span>
            </div>
          ) : (
            <div className="flex h-11 items-center justify-between border-b border-fog px-4">
              <span className="flex items-center gap-2">
                <span
                  className="text-[15px] font-medium"
                  style={{
                    backgroundImage: GEMINI_GRADIENT,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Gemini
                </span>
                <span className="flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[11px] font-medium text-muted">
                  2.5 Pro
                  <ChevronDown />
                </span>
              </span>
              <span
                className="h-6 w-6 rounded-full"
                style={{ backgroundImage: GEMINI_GRADIENT, opacity: 0.85 }}
                aria-hidden
              />
            </div>
          )}

          {/* ------------------------- Fil de conversation -------------------------
              Hauteur réservée sur la phase la plus haute — question envoyée,
              réponse écrite, trois résultats affichés. Sur mobile la question
              passe à la ligne, d'où les 272 px : sans cette réserve, la carte
              grandissait en fin de boucle puis retombait, et tout le bas de la
              home sautait à chaque cycle. */}
          <div className="flex min-h-[272px] flex-col gap-4 px-4 py-4 lg:min-h-[236px]">
            {/* Message utilisateur : apparaît une fois « envoyé » depuis le composer */}
            <div className="flex min-h-[34px] justify-end">
              <AnimatePresence>
                {sent && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.28, ease: [0.175, 0.885, 0.32, 1.1] }}
                      className={`max-w-[85%] px-3.5 py-2 text-[13px] leading-relaxed ${
                        isChatgpt
                          ? "rounded-[20px] bg-[#f4f4f4] text-[#0d0d0d]"
                          : "rounded-[20px] rounded-tr-md bg-[#e9eef6] text-[#1f1f1f]"
                      }`}
                    >
                      {fullQuery}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Réponse : avatar du moteur + contenu (réflexion → streaming → liste).
                  Rendue seulement une fois la question envoyée, sinon l'avatar
                  flotterait dans le vide pendant toute la saisie. */}
              {sent && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {isChatgpt ? (
                    <Image
                      src="/chatgpt.png"
                      alt=""
                      aria-hidden
                      width={32}
                      height={32}
                      className="h-[18px] w-[18px]"
                    />
                  ) : (
                    <GeminiSparkle
                      size={18}
                      spinning={phase === "thinking" || streaming}
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  {phase === "thinking" &&
                    (isChatgpt ? (
                      /* ChatGPT : point noir qui pulse avant la réponse */
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-1 block h-3 w-3 animate-pulse rounded-full bg-[#0d0d0d]"
                        aria-hidden
                      />
                    ) : (
                      /* Gemini : barres shimmer pendant la génération */
                      <div className="space-y-2 pt-1" aria-hidden>
                        <div className="shimmer h-2.5 w-3/4 rounded-full" />
                        <div className="shimmer h-2.5 w-1/2 rounded-full" />
                      </div>
                    ))}

                  {(streaming || phase === "results") && (
                    <div className="text-[13px] leading-relaxed text-[#1f1f1f]">
                      <p>
                        {streaming
                          ? introWords.slice(0, wordCount).join(" ")
                          : t("recommendIntro")}
                        {streaming && (
                          <span
                            className="ml-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
                            style={{
                              background: isChatgpt ? "#0d0d0d" : "#4285f4",
                            }}
                            aria-hidden
                          />
                        )}
                      </p>

                      {phase === "results" && (
                        <div className="mt-2.5 space-y-1">
                          {results.map((name, i) => {
                            const highlight = i === 0;
                            return (
                              <motion.div
                                key={name}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  delay: reduceMotion ? 0 : 0.12 + i * 0.22,
                                  duration: 0.3,
                                  ease: "easeOut",
                                }}
                                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                                  highlight
                                    ? isChatgpt
                                      ? "bg-mist"
                                      : "bg-[#f0f4f9]"
                                    : ""
                                }`}
                              >
                                <span className="w-4 shrink-0 text-right tabular-nums text-muted">
                                  {i + 1}.
                                </span>
                                <span
                                  className={
                                    highlight
                                      ? "truncate font-semibold text-[#0d0d0d]"
                                      : "truncate text-muted"
                                  }
                                >
                                  {name}
                                </span>
                                {highlight && (
                                  <span
                                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                                      isChatgpt
                                        ? "bg-obsidian text-white"
                                        : "bg-[#e8f0fe] text-[#1a73e8]"
                                    }`}
                                  >
                                    {t("citedFirst")}
                                  </span>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---------------- Composer fidèle : c'est ici que « tape » la démo ----------------
              Les deux composers n'ont pas la même hauteur (58 px pour ChatGPT,
              51,5 px pour Gemini) : on réserve la plus grande et on aligne en
              bas, sinon la carte se rétractait au changement de scénario. */}
          <div className="flex min-h-[58px] items-end px-3 pb-3 [&>*]:w-full">
            {isChatgpt ? (
              <div className="flex items-center gap-2.5 rounded-[24px] border border-[#e5e5e5] bg-snow px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <span className="shrink-0 text-muted">
                  <PlusIcon />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {composerText ? (
                    <span className="caret text-[#0d0d0d]">{composerText}</span>
                  ) : (
                    <span className="text-muted/70">{placeholder}</span>
                  )}
                </span>
                <span className="shrink-0 text-muted">
                  <MicIcon />
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white">
                  <WaveIcon />
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-full bg-[#f0f4f9] px-3.5 py-2.5">
                <span className="shrink-0 text-[#444746]">
                  <PlusIcon />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {composerText ? (
                    <span className="caret text-[#1f1f1f]">{composerText}</span>
                  ) : (
                    <span className="text-[#5f6368]">{placeholder}</span>
                  )}
                </span>
                <span className="shrink-0 text-[#444746]">
                  <MicIcon />
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
