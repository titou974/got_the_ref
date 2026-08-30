"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { motion, useReducedMotion } from "framer-motion";
import { approveAgentAction, denyAgentAction } from "@/features/mcp/actions";
import { MCP_AGENT_NAME } from "@/constants/mcp";
import { ROUTES } from "@/constants/routes";

/**
 * L'écran de consentement : « cet agent demande à appliquer vos correctifs ».
 *
 * Le code est le sujet de la page, pas une mention légale en bas de carte. Il
 * s'affiche en huit capuchons de clavier — la même grammaire que les touches
 * des moteurs sur la page d'accueil, et la forme que le client a sous les yeux
 * dans son terminal. Comparer deux codes est la seule chose qu'on lui demande
 * de faire ici : autant qu'elle soit lisible d'un mètre.
 *
 * Ce que l'agent obtient est écrit avant le bouton, pas après. Un consentement
 * qui explique ses conséquences une fois donné n'est pas un consentement.
 */

type Phase = "idle" | "approved" | "denied";

/** Un caractère du code, posé en capuchon. */
function Keycap({ char, index, reduced }: { char: string; index: number; reduced: boolean }) {
  return (
    <motion.span
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.22, ease: "easeOut" }}
      className="flex h-12 w-10 items-center justify-center rounded-[10px] bg-obsidian font-mono text-lg font-semibold tracking-normal text-snow shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_10px_rgba(9,9,11,0.22)] sm:h-14 sm:w-12 sm:text-xl"
    >
      {char}
    </motion.span>
  );
}

function CodeKeycaps({ code }: { code: string }) {
  const reduced = useReducedMotion() ?? false;

  return (
    <div className="flex items-center justify-center gap-1.5" aria-label={`Code ${code}`}>
      {code.split("").map((char, index) =>
        char === "-" ? (
          <span key={`sep-${index}`} className="px-1 text-lg text-pebble" aria-hidden>
            –
          </span>
        ) : (
          <Keycap key={`${char}-${index}`} char={char} index={index} reduced={reduced} />
        ),
      )}
    </div>
  );
}

function Bullet({ children, allowed }: { children: React.ReactNode; allowed: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-text">
      <span
        aria-hidden
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
          allowed ? "bg-success/15 text-success" : "bg-obsidian/8 text-steel"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          {allowed ? (
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path d="M6 12h12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          )}
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

export function AgentConsent({
  code,
  clientName,
  domain,
  offreLabel,
}: {
  code: string;
  clientName: string;
  /** Le site sur lequel l'agent va travailler, quand il y en a un. */
  domain: string | null;
  offreLabel: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  const approve = useAction(approveAgentAction, {
    onSuccess: () => setPhase("approved"),
  });
  const deny = useAction(denyAgentAction, {
    onSuccess: () => setPhase("denied"),
  });

  const error = approve.result?.serverError ?? deny.result?.serverError ?? null;
  const busy = approve.isPending || deny.isPending;

  if (phase === "approved") {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-5 text-xl font-bold text-text">{clientName} est connecté</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted">
          Retournez dans votre agent : {MCP_AGENT_NAME} relève vos correctifs et commence à les
          appliquer. Vous validez chaque changement avant publication.
        </p>
        <a
          href={ROUTES.dashboard}
          className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-fog px-5 py-2.5 text-sm font-medium text-text transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          Revenir au tableau de bord
        </a>
      </div>
    );
  }

  if (phase === "denied") {
    return (
      <div className="text-center">
        <h1 className="text-xl font-bold text-text">Demande refusée</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted">
          {clientName} n&apos;a reçu aucun accès. Le code est mort : pour réessayer, relancez la
          connexion depuis votre agent.
        </p>
        <a
          href={ROUTES.dashboard}
          className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-fog px-5 py-2.5 text-sm font-medium text-text transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          Revenir au tableau de bord
        </a>
      </div>
    );
  }

  return (
    <>
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-steel">
        Connexion d&apos;un agent
      </p>
      <h1 className="mt-3 text-balance text-center text-xl font-bold text-text sm:text-2xl">
        {clientName} demande à appliquer vos correctifs
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-center text-sm leading-relaxed text-muted">
        Vérifiez que ce code est bien celui affiché dans votre agent, puis autorisez la connexion.
      </p>

      <div className="mt-6">
        <CodeKeycaps code={code} />
      </div>

      <ul className="mt-7 space-y-2.5 rounded-[22px] border border-fog bg-mist px-5 py-4">
        <Bullet allowed>
          Lire le statut de votre compte {domain ? <>et de {domain}</> : null} — offre {offreLabel}
        </Bullet>
        <Bullet allowed>Lire les correctifs que votre offre ouvre, et les appliquer sur votre code</Bullet>
        <Bullet allowed>Expliquer votre analyse et ses correctifs</Bullet>
        <Bullet allowed={false}>Rien d&apos;autre : ni publication, ni déploiement, ni accès à un autre compte</Bullet>
      </ul>

      {error ? (
        <p className="mt-4 rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={() => approve.execute({ code })}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-wait disabled:opacity-70"
        >
          {approve.isPending ? "Connexion…" : `Autoriser ${clientName}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => deny.execute({ code })}
          className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-wait"
        >
          Refuser
        </button>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-steel">
        Accès révocable à tout moment depuis votre tableau de bord.
      </p>
    </>
  );
}
