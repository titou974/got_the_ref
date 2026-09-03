"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { AnalyzingOverlay } from "./AnalyzingOverlay";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { ROUTES, pricingWithReason, signInWithNext } from "@/constants/routes";
import { Portal } from "./Portal";
import { SignUpGateDialog } from "./SignUpGateDialog";

type Mode = "physical" | "online";

function extractDomain(input: string): string {
  try {
    const u = input.match(/^https?:\/\//i) ? input : "https://" + input;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

/** Où l'on retient l'e-mail déjà laissé, pour le reproposer sans le retaper. */
const LEAD_EMAIL_KEY = "geo:lead-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function UrlAnalyzeForm({
  size = "lg",
  askEmail = false,
  googleEnabled = false,
}: {
  size?: "lg" | "md";
  /**
   * Version gratuite (visiteur non connecté) : une modale d'inscription
   * s'ouvre avant l'analyse — Google, ou une adresse et un mot de passe. Le
   * compte gratuit ainsi ouvert emmène le visiteur sur son tableau de bord,
   * où l'analyse se joue sous ses yeux. Un visiteur connecté, lui, a déjà tout
   * ce qu'il faut : l'analyse part directement.
   */
  askEmail?: boolean;
  /**
   * Les identifiants OAuth sont-ils configurés ? Le drapeau vit côté serveur
   * (`isGoogleAuthEnabled`) et descend jusqu'ici : afficher un bouton Google
   * sans fournisseur branché mène le visiteur sur une route de rappel qui
   * échoue.
   */
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("analyzeForm");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("physical");
  const [mapsUrl, setMapsUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmNoMaps, setConfirmNoMaps] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapsInputRef = useRef<HTMLInputElement>(null);
  // Adresse déjà laissée lors d'une visite précédente : elle pré-remplit le
  // champ de la modale. Elle ne dispense pas de s'inscrire — il y a un mot de
  // passe à choisir, et c'est un compte qu'on ouvre. Relue à l'ouverture de la
  // modale, jamais au montage : le premier rendu doit être identique à celui du
  // serveur, qui ne connaît pas le stockage du navigateur.
  const [knownEmail, setKnownEmail] = useState("");

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

  /** Lance réellement l'analyse (après validation et confirmation éventuelle). */
  async function runAnalysis() {
    const trimmed = url.trim();
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
        // Sans ce retrait, l'overlay opaque plein écran reste monté si la
        // navigation client tarde ou échoue : plus rien n'est cliquable.
        setAnalyzing(false);
        router.push(pricingWithReason("quota"));
        return;
      }

      // Analyse gratuite déjà consommée. On ne renvoie pas le visiteur les
      // mains vides : son rapport existe, on le rouvre. C'est aussi le meilleur
      // endroit pour lui montrer ce que l'abonnement débloquerait dessus.
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setAnalyzing(false);
        if (data.analysisId) {
          router.push(ROUTES.analysis(String(data.analysisId)));
          return;
        }
        setError(data.error ?? t("errorFailed"));
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

  /**
   * La question de la fiche Maps réglée, on passe à la suite : l'inscription
   * pour un visiteur non identifié, l'analyse directement pour les autres.
   *
   * L'ordre a changé le jour où la modale est devenue une inscription. Demander
   * un mot de passe puis revenir sur « avez-vous une fiche Google Maps ? »
   * ferait reculer quelqu'un qui vient de s'engager ; la question de la fiche
   * porte sur le site, elle se pose donc avec le site.
   */
  function continueAfterMaps() {
    if (askEmail) {
      try {
        const saved = window.localStorage.getItem(LEAD_EMAIL_KEY);
        setKnownEmail(saved && EMAIL_RE.test(saved) ? saved : "");
      } catch {
        /* stockage indisponible (navigation privée) : le champ reste vide */
      }
      setSigningUp(true);
      return;
    }
    runAnalysis();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t("errorEmpty"));
      return;
    }
    // Commerce physique sans fiche Maps : on propose d'en ajouter une avant de
    // lancer quoi que ce soit.
    if (mode === "physical" && !mapsUrl.trim()) {
      setConfirmNoMaps(true);
      return;
    }
    continueAfterMaps();
  }

  /** L'adresse retenue pour la prochaine visite, une fois le compte ouvert. */
  function rememberEmail(email: string) {
    try {
      window.localStorage.setItem(LEAD_EMAIL_KEY, email);
    } catch {
      /* stockage indisponible : sans effet sur le compte qui vient de naître */
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
          className="mb-3 inline-flex rounded-full border border-fog bg-snow p-0.5"
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
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${
                  isActive
                    ? "bg-obsidian text-white"
                    : "text-muted hover:text-text"
                }`}
              >
                <span aria-hidden>
                  {m === "physical" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M4 9.5a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0M9.5 19.5v-5h5v5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                </span>
                {t(m === "physical" ? "modePhysical" : "modeOnline")}
              </button>
            );
          })}
        </div>

        <div
          className={`flex items-center gap-2 rounded-full border border-fog bg-snow p-1.5 transition-[border-color,box-shadow] duration-200 focus-within:border-pebble focus-within:shadow-[var(--shadow-md)] ${
            big ? "sm:gap-2.5" : ""
          }`}
        >
          <span className="pl-2.5 text-muted" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
              big ? "py-2 text-[15px] sm:text-base" : "py-2 text-sm"
            }`}
          />
          <button
            type="submit"
            disabled={analyzing}
            className={`shrink-0 cursor-pointer rounded-full bg-cta text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60 ${
              big ? "px-4 py-2 sm:px-5 sm:py-2.5" : "px-3.5 py-2"
            }`}
          >
            {analyzing ? (
              t("submitting")
            ) : (
              <>
                <span className="sm:hidden">{t("submitShort")}</span>
                <span className="hidden sm:inline">{t("submit")}</span>
              </>
            )}
          </button>
        </div>

        {/* Fiche Google Maps : toujours visible pour un commerce physique,
            essentielle à l'analyse de la position locale. */}
        {mode === "physical" && (
          <div className="mt-3">
            <label
              htmlFor="maps-url"
              className="mb-1.5 flex items-center gap-2 pl-2 text-xs font-medium text-text"
            >
              {t("mapsFieldLabel")}
              <span className="rounded-full bg-mist px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-steel">
                {t("mapsRecommended")}
              </span>
            </label>
            <div className="flex items-center gap-2 rounded-full border border-fog bg-snow p-1 transition-[border-color] duration-200 focus-within:border-pebble">
              <span className="pl-2.5 text-muted" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </span>
              <input
                id="maps-url"
                ref={mapsInputRef}
                type="text"
                inputMode="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder={t("mapsPlaceholder")}
                aria-label={t("mapsAriaLabel")}
                className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-text placeholder:text-muted/70 focus:outline-none"
              />
            </div>
            <p className="mt-2 pl-2 text-xs text-muted">{t("mapsHint")}</p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>

      {/* Modale : l'inscription qui ouvre l'espace gratuit. Google en haut,
          l'adresse et le mot de passe en dessous. */}
      <Portal>
        <AnimatePresence>
          {signingUp && (
            <SignUpGateDialog
              site={{
                url: url.trim(),
                mode,
                mapsUrl: mode === "physical" ? mapsUrl.trim() || null : null,
              }}
              defaultEmail={knownEmail}
              googleEnabled={googleEnabled}
              signInHref={signInWithNext(ROUTES.dashboard)}
              onEmailKept={rememberEmail}
              onClose={() => setSigningUp(false)}
            />
          )}
        </AnimatePresence>
      </Portal>

      {/* Modale : confirme le lancement sans fiche Google Maps. */}
      <Portal>
        <AnimatePresence>
          {confirmNoMaps && (
            <ConfirmNoMapsDialog
              labels={{
                title: t("confirmTitle"),
                body: t("confirmBody"),
                add: t("confirmAdd"),
                without: t("confirmWithout"),
                close: t("confirmClose"),
              }}
              onAdd={() => {
                setConfirmNoMaps(false);
                mapsInputRef.current?.focus();
              }}
              onWithout={() => {
                setConfirmNoMaps(false);
                continueAfterMaps();
              }}
              onClose={() => setConfirmNoMaps(false)}
            />
          )}
        </AnimatePresence>
      </Portal>

      {/* L'overlay d'analyse est plein écran : il doit sortir de la carte, dont
          le survol (`.card-cal:hover`) crée un bloc conteneur et le rognerait. */}
      <Portal>
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
      </Portal>
    </>
  );
}

/* ----------------------- Modale « pas de fiche Maps » ---------------------- */

function ConfirmNoMapsDialog({
  labels,
  onAdd,
  onWithout,
  onClose,
}: {
  labels: {
    title: string;
    body: string;
    add: string;
    without: string;
    close: string;
  };
  onAdd: () => void;
  onWithout: () => void;
  onClose: () => void;
}) {
  // Échap ferme la modale ; verrou du scroll tant qu'elle est ouverte.
  useBodyScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[110] flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* `cursor-pointer` n'est pas décoratif : iOS Safari ne dispatche pas de
          `click` sur un élément non interactif qui n'a pas ce curseur, et le
          « appuyer à côté pour fermer » resterait mort sur iPhone. */}
      <div
        className="absolute inset-0 cursor-pointer bg-obsidian/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-maps-title"
        className="relative w-full max-w-md rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-7"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mist text-accent">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle
              cx="12"
              cy="10"
              r="2.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        </span>

        <h2
          id="confirm-maps-title"
          className="mt-4 text-lg font-bold text-text sm:text-xl"
        >
          {labels.title}
        </h2>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
          {labels.body}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onAdd}
            className="cursor-pointer rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {labels.add}
          </button>
          <button
            type="button"
            onClick={onWithout}
            className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {labels.without}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
