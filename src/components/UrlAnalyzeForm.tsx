"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "framer-motion";
import { AnalyzingOverlay } from "./AnalyzingOverlay";
import { ROUTES, pricingWithReason } from "@/constants/routes";

type Mode = "physical" | "online";

function extractDomain(input: string): string {
  try {
    const u = input.match(/^https?:\/\//i) ? input : "https://" + input;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

export function UrlAnalyzeForm({ size = "lg" }: { size?: "lg" | "md" }) {
  const router = useRouter();
  const t = useTranslations("analyzeForm");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("physical");
  const [mapsUrl, setMapsUrl] = useState("");
  const [showMaps, setShowMaps] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coordination : on ne redirige que lorsque l'API a répondu ET que
  // l'animation a parcouru toutes ses étapes (faux temps).
  const resultIdRef = useRef<string | null>(null);
  const animDoneRef = useRef(false);
  const navigatedRef = useRef(false);

  function maybeNavigate() {
    if (navigatedRef.current) return;
    if (resultIdRef.current && animDoneRef.current) {
      navigatedRef.current = true;
      router.push(ROUTES.analysis(resultIdRef.current));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t("errorEmpty"));
      return;
    }
    setError(null);
    resultIdRef.current = null;
    animDoneRef.current = false;
    navigatedRef.current = false;
    setAnalyzing(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          mode,
          mapsUrl: mode === "physical" ? mapsUrl.trim() || null : null,
        }),
      });

      if (res.status === 402) {
        router.push(pricingWithReason("quota"));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("errorFailed"));
        setAnalyzing(false);
        return;
      }

      const { id } = await res.json();
      resultIdRef.current = String(id);
      // L'animation continue ; la navigation se fera quand elle aura fini.
      maybeNavigate();
    } catch {
      setError(t("errorNetwork"));
      setAnalyzing(false);
    }
  }

  const big = size === "lg";

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full">
        {/* Choix du type de commerce : pilote l'affichage du champ Maps. */}
        <div
          role="tablist"
          aria-label={t("modeAriaLabel")}
          className="mb-3 inline-flex rounded-xl border border-border bg-surface/50 p-1"
        >
          {(["physical", "online"] as Mode[]).map((m) => {
            const isActive = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMode(m)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  isActive
                    ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/40"
                    : "text-muted hover:text-text"
                }`}
              >
                <span aria-hidden>
                  {m === "physical" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M4 9.5a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0M9.5 19.5v-5h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                </span>
                {t(m === "physical" ? "modePhysical" : "modeOnline")}
              </button>
            );
          })}
        </div>

        <div
          className={`glass-strong flex items-center gap-2 rounded-2xl p-2 shadow-2xl shadow-black/40 ${
            big ? "sm:gap-3 sm:p-2.5" : ""
          }`}
        >
          <span className="pl-3 text-muted" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M10 21a11 11 0 1 1 0-18m0 18a11 11 0 0 0 0-18m0 18c2.5 0 4-4 4-9s-1.5-9-4-9m-9 9h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("ariaLabel")}
            autoComplete="url"
            className={`min-w-0 flex-1 bg-transparent text-text placeholder:text-muted/70 focus:outline-none ${
              big ? "py-3 text-base sm:text-lg" : "py-2.5 text-base"
            }`}
          />
          <button
            type="submit"
            disabled={analyzing}
            className={`shrink-0 cursor-pointer rounded-xl bg-cta font-semibold text-white transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60 ${
              big ? "px-5 py-3 text-sm sm:px-7 sm:text-base" : "px-4 py-2.5 text-sm"
            }`}
          >
            {analyzing ? t("submitting") : t("submit")}
          </button>
        </div>

        {mode === "physical" &&
          (showMaps ? (
          <div className="mt-3">
            <label htmlFor="maps-url" className="sr-only">
              {t("mapsLabel")}
            </label>
            <div className="glass-strong flex items-center gap-2 rounded-2xl p-2">
              <span className="pl-3 text-muted" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              <input
                id="maps-url"
                type="text"
                inputMode="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder={t("mapsPlaceholder")}
                aria-label={t("mapsAriaLabel")}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-text placeholder:text-muted/70 focus:outline-none"
              />
            </div>
            <p className="mt-2 pl-2 text-xs text-muted">{t("mapsHint")}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMaps(true)}
            className="mt-3 cursor-pointer pl-2 text-sm text-accent transition-colors duration-200 hover:underline"
          >
            {t("mapsToggle")}
          </button>
          ))}

        {error && (
          <p className="mt-3 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>

      <AnimatePresence>
        {analyzing && (
          <AnalyzingOverlay
            domain={extractDomain(url)}
            onComplete={() => {
              animDoneRef.current = true;
              maybeNavigate();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
