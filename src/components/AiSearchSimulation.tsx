"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import Image from "next/image";

type Engine = {
  name: string;
  color: string;
  icon: React.ReactNode;
};

const ENGINES: Record<string, Engine> = {
  perplexity: {
    name: "Perplexity",
    color: "#3fd6ad",
    icon: (
      <Image
        src="/perplexity.png"
        alt="Perplexity"
        width={32}
        height={32}
        className="bg-white rounded w-4 h-4"
      />
    ),
  },
  chatgpt: {
    name: "ChatGPT",
    color: "#11b48c",
    icon: (
      <Image
        src="/chatgpt.png"
        alt="ChatGPT"
        width={32}
        height={32}
        className="bg-white rounded w-4 h-4 p-0.5"
      />
    ),
  },
  gemini: {
    name: "Gemini",
    color: "#7fe9cf",
    icon: (
      <Image
        className="w-4 h-4"
        src="/gemini.webp"
        alt="Gemini"
        width={32}
        height={32}
      />
    ),
  },
};

type Scenario = {
  engine: keyof typeof ENGINES;
  query: string;
  /** Concurrents fictifs affichés après « Votre entreprise » (donnée de démo). */
  competitors: string[];
};

const SCENARIOS: Scenario[] = [
  {
    engine: "perplexity",
    query: "meilleur restaurant italien à Lyon",
    competitors: ["Trattoria del Centro", "La Tavola Lyonnaise"],
  },
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

type Phase = "typing" | "thinking" | "answer";

export function AiSearchSimulation() {
  const t = useTranslations("aiSimulation");
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");

  const scenario = SCENARIOS[scenarioIdx];
  const engine = ENGINES[scenario.engine];
  const fullQuery = scenario.query;
  const results = [t("yourBusiness"), ...scenario.competitors];

  // Effet machine à écrire
  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length < fullQuery.length) {
      const t = setTimeout(
        () => setTyped(fullQuery.slice(0, typed.length + 1)),
        55,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("thinking"), 600);
    return () => clearTimeout(t);
  }, [phase, typed, fullQuery]);

  // Réflexion → réponse
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => setPhase("answer"), 1600);
    return () => clearTimeout(t);
  }, [phase]);

  // Réponse → scénario suivant
  useEffect(() => {
    if (phase !== "answer") return;
    const t = setTimeout(() => {
      setTyped("");
      setPhase("typing");
      setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
    }, 3200);
    return () => clearTimeout(t);
  }, [phase]);

  const tabs = useMemo(() => Object.entries(ENGINES), []);

  return (
    <div className="glass-strong w-full overflow-hidden rounded-2xl">
      {/* Onglets moteurs */}
      <div className="flex items-center gap-1 border-b border-white/8 px-3 py-2">
        {tabs.map(([key, e]) => {
          const active = key === scenario.engine;
          return (
            <div
              key={key}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-300 ${
                active ? "bg-white/8 text-text" : "text-muted/60"
              }`}
              style={active ? { color: e.color } : undefined}
            >
              <span style={{ color: active ? e.color : undefined }}>
                {e.icon}
              </span>
              <span className="hidden sm:inline">{e.name}</span>
            </div>
          );
        })}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-cta" /> {t("live")}
        </span>
      </div>

      <div className="min-h-[200px] space-y-3 p-4">
        {/* Requête utilisateur */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/20 px-3.5 py-2 text-sm">
            <span className={phase === "typing" ? "caret" : ""}>{typed}</span>
          </div>
        </div>

        {/* Réponse IA */}
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${engine.color}22`, color: engine.color }}
          >
            {engine.icon}
          </span>
          <div className="min-h-[120px] flex-1">
            <AnimatePresence mode="wait">
              {phase === "thinking" && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 pt-1.5 text-sm text-muted"
                >
                  <span className="flex gap-1">
                    <span
                      className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted"
                      style={{ animationDelay: "0s" }}
                    />
                    <span
                      className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span
                      className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </span>
                  <span>{t("searching", { engine: engine.name })}</span>
                </motion.div>
              )}

              {phase === "answer" && (
                <motion.div
                  key="answer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <p className="text-sm text-muted">{t("recommendIntro")}</p>
                  {results.map((name, i) => {
                    const highlight = i === 0;
                    return (
                      <motion.div
                        key={name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.35 }}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${
                          highlight
                            ? "border-cta/40 bg-cta/10"
                            : "border-white/8 bg-white/[0.03]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            highlight
                              ? "bg-cta text-white"
                              : "bg-white/10 text-muted"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span
                          className={
                            highlight ? "font-semibold text-text" : "text-muted"
                          }
                        >
                          {name}
                        </span>
                        {highlight && (
                          <span className="ml-auto rounded-full bg-cta/20 px-2 py-0.5 text-[11px] font-medium text-cta">
                            {t("citedFirst")}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
