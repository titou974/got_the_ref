"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { StackMark } from "@/components/StackMark";
import { ROUTES, signInWithNext } from "@/constants/routes";
import {
  SiteConnectForm,
  type SiteConnectSetup,
} from "@/components/tableau-de-bord/SiteConnectForm";
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
 * Les agents dans lesquels le prompt se colle. Les montrer évite la question
 * « c'est pour quel outil ? » : le client reconnaît le sien et sait quoi faire.
 */
const AGENTS = [
  { name: "ChatGPT", logo: "/chatgpt.png" },
  { name: "Claude", logo: "/claude.svg" },
  { name: "Cursor", logo: null },
] as const;

/** Le cube de Cursor, dessiné ici : aucun fichier de marque dans /public. */
function CursorMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3.9 7.3 12 12l8.1-4.7M12 12v9.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function AgentLogos() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {AGENTS.map((agent) =>
        agent.logo ? (
          <Image
            key={agent.name}
            src={agent.logo}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 rounded-[4px] bg-white object-contain p-px"
          />
        ) : (
          <span
            key={agent.name}
            className="flex h-4 w-4 items-center justify-center"
          >
            <CursorMark />
          </span>
        ),
      )}
    </span>
  );
}

/**
 * Ce que le compte gratuit voit à la place du prompt : le bouton qui mène aux
 * tarifs, et rien d'autre. Le rattachement du site reste au-dessus, ouvert.
 *
 * Il n'y a plus de voile ici. Les boutons floutés qu'on posait dessous se
 * lisaient comme une salissure derrière le bouton — la pilule noire du décor
 * bavait autour de la vraie —, et ils ne montraient rien qu'on ne sache déjà :
 * la console des agents, nette juste au-dessus, a fait la démonstration, et le
 * titre de la modale a dit ce qui s'achète.
 *
 * Le prompt, lui, n'est pas seulement absent de l'écran : le serveur ne l'écrit
 * pas pour un compte gratuit (cf. `SolveAgentsDock`). Un voile CSS se contourne
 * avec l'inspecteur ; une chaîne absente, non.
 */
function LockedActions() {
  const t = useTranslations("analysisReport.solve.modal");

  return (
    <Link
      href={ROUTES.pricing}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-3 text-center text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
    >
      {t("lockedCta")}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <path
          d="M5 12h14M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

/**
 * L'entrée du rattachement, dans la modale.
 *
 * Depuis le tableau de bord, elle ouvre le formulaire sur place : le client
 * vient de voir ses manques, il n'a pas à aller les chercher ailleurs. Depuis
 * le rapport public, il n'y a pas de compte où poser un identifiant — le bouton
 * mène aux réglages, en passant par la connexion.
 *
 * Quand le lien existe déjà, le bouton le dit et sert à le corriger : un
 * « connecter le site » sur un site rattaché ferait douter de ce qui est en
 * place.
 */
function ConnectAction({
  connect,
  onOpen,
}: {
  connect: SiteConnectSetup | null;
  onOpen: () => void;
}) {
  const t = useTranslations("analysisReport.solve.modal");

  const style =
    "flex cursor-pointer items-center justify-center gap-2 rounded-full bg-obsidian px-5 py-3 text-center text-sm font-medium text-white transition-colors duration-200 hover:bg-obsidian/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40";

  if (!connect) {
    return (
      <Link href={signInWithNext(ROUTES.dashboardSettings)} className={style}>
        {t("cta")}
      </Link>
    );
  }

  const connected = connect.link?.status === "connected";

  return (
    <>
      <button type="button" onClick={onOpen} className={style}>
        {connected ? t("connectManage") : t("cta")}
      </button>
      {connected ? (
        <p className="text-center text-xs text-muted">
          {t("connectedNote", { site: connect.link?.siteUrl ?? "" })}
        </p>
      ) : null}
    </>
  );
}

export function ConnectSiteModal({
  domain,
  stack,
  issues,
  solutionPrompt,
  scope = "report",
  locked = false,
  connect = null,
  onClose,
}: {
  domain: string;
  stack: DetectedStack | null;
  /** Manques relevés dans le rapport, rejoués dans l'en-tête (3 au plus). */
  issues: string[];
  /** Le prompt de correction, pour qui préfère faire appliquer à la main. */
  solutionPrompt: string;
  /**
   * Depuis le rapport, le prompt ne couvre que le plan d'action ; depuis le
   * tableau de bord, il couvre les six sections. Seul le libellé du bouton
   * change — la promesse n'est pas la même.
   */
  scope?: "report" | "dashboard";
  /**
   * Compte gratuit : le prompt de correction passe sous voile et l'appel vers
   * les tarifs prend sa place. Le rattachement du site, lui, reste ouvert : il
   * ne donne accès à rien de payant par lui-même, et c'est l'étape qu'on veut
   * voir faite avant l'abonnement, pas après.
   */
  locked?: boolean;
  /**
   * De quoi rattacher le site sans quitter la modale. Nul depuis le rapport
   * public : il n'y a pas de session, donc pas de compte où enregistrer un
   * identifiant — le bouton mène alors à la page des réglages.
   */
  connect?: SiteConnectSetup | null;
  onClose: () => void;
}) {
  const t = useTranslations("analysisReport.solve.modal");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [connecting, setConnecting] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(solutionPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : rien à signaler, le bouton ne change pas */
    }
  }

  /**
   * Passer le travail au développeur, c'est lui passer le prompt — pas un lien
   * vers un écran auquel il n'a pas accès. Sur mobile, la feuille de partage du
   * système l'envoie où le client veut ; ailleurs, il n'y a rien à ouvrir et la
   * copie fait le même travail.
   */
  async function shareWithDeveloper() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: t("shareDevTitle", { domain }),
          text: solutionPrompt,
        });
        return;
      } catch {
        // Partage annulé ou refusé : on retombe sur la copie.
      }
    }

    try {
      await navigator.clipboard.writeText(solutionPrompt);
      setShared(true);
      window.setTimeout(() => setShared(false), 2600);
    } catch {
      /* presse-papiers indisponible : le prompt reste copiable à la main */
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

          {/* Deux voies, et le client choisit : rattacher son site — les agents
              publient alors eux-mêmes — ou repartir avec le prompt et le faire
              appliquer à la main. Le rattachement passait auparavant par un
              bouton désactivé marqué « bientôt » ; il est ouvert, donc il
              s'ouvre ici, au moment où la console vient de montrer ce qu'il y a
              à corriger. */}
          <div className="mt-5 flex flex-col gap-2.5">
            {connecting && connect ? (
              <>
                <SiteConnectForm
                  setup={connect}
                  dense
                  // Le lien accepté, on revient sur les actions : l'état du
                  // rattachement s'y lit désormais sous le bouton.
                  onConnected={() => setConnecting(false)}
                />
                <button
                  type="button"
                  onClick={() => setConnecting(false)}
                  className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
                >
                  {t("connectBack")}
                </button>
              </>
            ) : (
              <>
            <ConnectAction connect={connect} onOpen={() => setConnecting(true)} />

            {locked ? (
              <LockedActions />
            ) : (
              <>
            <button
              type="button"
              autoFocus
              onClick={copyPrompt}
              className="flex cursor-pointer items-center justify-center gap-2.5 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              <span className="text-pretty">
                {copied
                  ? t("promptCopied")
                  : scope === "dashboard"
                    ? t("promptCtaAll")
                    : t("promptCta")}
              </span>
            </button>

            {/* Le début du prompt, sous le bouton.
                Copier un texte qu'on n'a pas vu demande de la confiance ; en
                montrer l'entrée coûte quatre lignes et lève la question. Les
                logos passent au-dessus, à gauche : dans le bouton, ils
                décalaient un libellé déjà long sans dire à quoi ils servaient.
                Au-dessus du prompt, ils disent où le coller. */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <AgentLogos />
                <span className="text-xs text-muted">
                  {t("promptPreviewLabel")}
                </span>
              </div>
              <div className="relative">
                <pre className="max-h-40 overflow-hidden whitespace-pre-wrap break-words rounded-2xl border border-fog bg-mist px-4 py-3 font-sans text-[11px] leading-relaxed text-muted">
                  {solutionPrompt}
                </pre>
                {/* Le texte s'éteint vers le bas : c'est un extrait, et une
                    coupe nette se lirait comme un prompt tronqué à la copie. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-px bottom-px h-16 rounded-b-2xl bg-gradient-to-b from-transparent to-mist"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={shareWithDeveloper}
              className="cursor-pointer rounded-full border border-fog px-5 py-2.5 text-sm font-medium text-text transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {shared ? t("shareDevDone") : t("shareDev")}
            </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {t("later")}
            </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
