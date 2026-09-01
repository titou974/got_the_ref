"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  MCP_AGENT_IDS,
  MCP_AGENT_NAMES,
  MCP_FIRST_PROMPT,
  MCP_SERVER_NAME,
  mcpAgentSetups,
  type McpAgentId,
} from "@/constants/mcp";
import { createAgentKeyAction } from "@/features/mcp/actions";
import { ROUTES } from "@/constants/routes";

/**
 * Le rattachement de l'agent IA — ce qui remplace le prompt qu'on copiait.
 *
 * Le prompt était un texte de plusieurs milliers de caractères : le client le
 * copiait, le collait, et la suite se jouait hors de notre vue. Il repartait à
 * zéro à chaque nouvelle mesure, et personne, ici, ne savait jamais s'il avait
 * été appliqué.
 *
 * À la place, une prise. Le client crée sa clé ici, colle une ligne dans son
 * agent, et l'agent va chercher lui-même les correctifs à chaque passe — sans
 * rien installer, la prise étant servie par le site. Ce qui se copie n'est donc
 * plus la matière, c'est une ligne de commande — et une ligne de commande, ça
 * se lit avant de se coller.
 *
 * D'où la forme : le bloc sombre en police à chasse fixe dit ce qu'il est, un
 * terminal. Il prolonge la console des agents en tête de modale, où les manques
 * du site passent en « corrigé » les uns après les autres.
 *
 * La commande n'apparaît qu'une fois demandée, et une seule fois : elle porte
 * la clé du compte, dont le serveur ne garde que l'empreinte. C'est aussi
 * pourquoi elle ne s'affiche pas d'office à l'ouverture de la modale — un
 * secret ne se met pas à l'écran de quelqu'un qui n'a rien demandé.
 *
 * Le rail des trois étapes est la seule chose qui bouge. Il se remplit pour de
 * vrai : la dernière étape ne s'allume que lorsqu'un agent s'est réellement
 * connecté — la modale le demande à la plateforme pendant qu'elle est ouverte.
 */

/** Rythme de relevé pendant que la modale attend l'appairage. */
const POLL_MS = 4_000;

type AgentsPayload = {
  agents: { id: string; nom: string; depuis: string; dernierUsage: string | null }[];
  derniere: { agent: string; chantier: string; appliques: number; date: string } | null;
};

function CursorMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3.9 7.3 12 12l8.1-4.7M12 12v9.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Hermes n'a pas de fichier de marque ici : une aile stylisée, en trait. */
function HermesMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h9M4 12h13M4 16h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M18 7.5 21 12l-3 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AgentMark({ id }: { id: McpAgentId }) {
  if (id === "claude") {
    return (
      <Image src="/claude.svg" alt="" width={15} height={15} className="h-[15px] w-[15px] rounded-[4px]" />
    );
  }
  if (id === "codex") {
    return (
      <Image
        src="/logoopenai1.png"
        alt=""
        width={15}
        height={15}
        className="h-[15px] w-[15px] object-contain"
      />
    );
  }
  return id === "cursor" ? <CursorMark /> : <HermesMark />;
}

function CopyButton({
  value,
  tone = "dark",
  label,
  copiedLabel,
}: {
  value: string;
  tone?: "dark" | "light";
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* presse-papiers indisponible : la commande reste sélectionnable */
        }
      }}
      className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${
        tone === "dark"
          ? "bg-white/12 text-white/80 hover:bg-white/20 hover:text-white focus-visible:ring-white/40"
          : "border border-fog bg-snow text-text hover:bg-mist focus-visible:ring-obsidian/40"
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

/**
 * Le rail des trois étapes. Il encode l'ordre réel du rattachement — installer,
 * autoriser, corriger —, pas une progression décorative : la troisième pastille
 * ne verdit que lorsqu'un agent s'est appairé pour de bon.
 */
function Rail({ reached }: { reached: number }) {
  const t = useTranslations("analysisReport.solve.modal.mcp");
  const reduced = useReducedMotion();
  const steps = [t("stepInstall"), t("stepAuthorize"), t("stepFix")];

  return (
    <ol className="flex items-center gap-1.5">
      {steps.map((step, index) => {
        const done = index < reached;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-1.5">
            <motion.span
              animate={{
                backgroundColor: done ? "rgba(17,180,140,0.14)" : "rgba(9,9,11,0.05)",
                color: done ? "#0d8f6f" : "#71717a",
              }}
              transition={reduced ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
              className="flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            >
              <span className="tabular-nums">{index + 1}</span>
              <span className="truncate">{step}</span>
            </motion.span>
            {index < steps.length - 1 && (
              <span aria-hidden className="h-px min-w-2 flex-1 bg-fog" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** « il y a trois minutes » — la seule mise en forme de date de ce panneau. */
function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}

export function AgentLinkPanel({
  locked = false,
  onEndpoint,
}: {
  locked?: boolean;
  /** Remonte l'adresse créée, pour la transmission à un développeur. */
  onEndpoint?: (endpoint: string | null) => void;
}) {
  const t = useTranslations("analysisReport.solve.modal.mcp");
  const [agent, setAgent] = useState<McpAgentId>("claude");
  const [state, setState] = useState<AgentsPayload | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  // La clé n'existe en clair que dans la réponse de l'action : on la garde ici,
  // le temps de la modale, et nulle part ailleurs.
  const createKey = useAction(createAgentKeyAction, {
    onSuccess: ({ data }) => {
      setEndpoint(data?.adresse ?? null);
      onEndpoint?.(data?.adresse ?? null);
    },
  });

  const setup = useMemo(() => {
    if (!endpoint) return null;
    const setups = mcpAgentSetups(endpoint);
    return setups.find((item) => item.id === agent) ?? setups[0];
  }, [endpoint, agent]);

  // Une clé qui existe ne prouve rien : c'est son premier usage qui dit que
  // l'agent est branché pour de bon.
  const connected = state?.agents.some((item) => item.dernierUsage) ?? false;
  const lastPass = relativeTime(state?.derniere?.date ?? null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp/agents", { cache: "no-store" });
      if (!response.ok) return;
      setState((await response.json()) as AgentsPayload);
    } catch {
      /* hors ligne : le rail reste sur son étape, rien à annoncer */
    }
  }, []);

  // Le relevé s'arrête dès qu'un agent est appairé : la modale n'a plus rien à
  // attendre, et une boucle qui tourne pour rien tient la page éveillée.
  //
  // Le premier relevé passe par un `setTimeout(0)` plutôt que par un appel
  // direct : l'effet ne fait ainsi que brancher et débrancher une source
  // extérieure, sans déclencher lui-même le rendu suivant.
  useEffect(() => {
    if (connected) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, connected]);

  return (
    <div className="space-y-4">
      {/* Le choix de l'agent. Quatre onglets, pas un menu déroulant : le client
          doit voir tout de suite que le sien est pris en charge. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {MCP_AGENT_IDS.map((id) => {
          const active = id === agent;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAgent(id)}
              aria-pressed={active}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${
                active
                  ? "border-obsidian bg-obsidian text-white"
                  : "border-fog bg-snow text-muted hover:border-pebble hover:text-text"
              }`}
            >
              <AgentMark id={id} />
              {MCP_AGENT_NAMES[id]}
            </button>
          );
        })}
      </div>

      {/* Étape 1 — la prise, en clair, dans un bloc qui ressemble au terminal
          où elle sera collée. */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-steel">
          {setup ? t("installLabel", { where: setup.where }) : t("keyLabel")}
        </p>

        {!setup ? (
          // La commande porte la clé du compte : elle ne s'affiche que sur
          // demande, et le serveur n'en garde ensuite que l'empreinte.
          <div className="rounded-[18px] border border-fog bg-mist p-3">
            <button
              type="button"
              onClick={() => createKey.execute({ agent })}
              disabled={createKey.isPending}
              className="w-full cursor-pointer rounded-[14px] bg-obsidian px-4 py-2.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-wait disabled:opacity-60"
            >
              {createKey.isPending
                ? t("keyPending")
                : t("keyCta", { name: MCP_AGENT_NAMES[agent] })}
            </button>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              {createKey.hasErrored ? t("keyError") : t("keyNote")}
            </p>
          </div>
        ) : setup.kind === "link" ? (
          // Cursor n'a pas de sous-commande d'installation : il a un lien, que
          // le navigateur remet à l'éditeur. On le donne donc comme un lien,
          // cliquable, plutôt que comme une ligne à recopier.
          <a
            href={setup.snippet}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] bg-obsidian p-3 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {t("openIn", { name: setup.name })}
            <span aria-hidden className="text-white/60">
              ↗
            </span>
          </a>
        ) : (
          <div className="flex items-start gap-2 rounded-[18px] bg-obsidian p-3">
            <pre
              className={`min-w-0 flex-1 font-mono text-[11px] leading-relaxed text-white/85 ${
                setup.kind === "cli"
                  ? "whitespace-pre-wrap break-words"
                  : "overflow-x-auto whitespace-pre"
              }`}
            >
              {setup.snippet}
            </pre>
            <CopyButton value={setup.snippet} label={t("copy")} copiedLabel={t("copied")} />
          </div>
        )}

        {/* Le repli manuel, replié : il n'est utile qu'au client dont le lien
            n'a pas atteint l'éditeur, et il n'a pas à peser sur les autres. */}
        {setup ? (
          <p className="mt-2 text-[12px] leading-relaxed text-muted">{t("keyOnce")}</p>
        ) : null}

        {setup?.fallback ? (
          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-[12px] text-muted transition-colors duration-200 hover:text-text">
              {t("fallbackLabel", { where: setup.fallback.where })}
            </summary>
            <div className="mt-2 flex items-start gap-2 rounded-[18px] border border-fog bg-mist p-3">
              <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-text">
                {setup.fallback.snippet}
              </pre>
              <CopyButton
                value={setup.fallback.snippet}
                tone="light"
                label={t("copy")}
                copiedLabel={t("copied")}
              />
            </div>
          </details>
        ) : null}
      </div>

      {/* Étape 2 — la phrase à dire, une fois la prise en place. */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-steel">
          {t("promptLabel")}
        </p>
        <div className="flex items-center gap-2 rounded-[18px] border border-fog bg-mist p-3">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-text">
            « {MCP_FIRST_PROMPT} »
          </p>
          <CopyButton
            value={MCP_FIRST_PROMPT}
            tone="light"
            label={t("copy")}
            copiedLabel={t("copied")}
          />
        </div>
      </div>

      <Rail reached={connected ? 3 : endpoint ? 2 : 1} />

      {/* L'état réel du rattachement, relevé côté plateforme. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={connected ? "connected" : "waiting"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2 text-[13px] leading-relaxed"
        >
          <span
            aria-hidden
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
              connected ? "bg-success" : "bg-pebble"
            }`}
          />
          <p className={connected ? "text-text" : "text-muted"}>
            {connected ? t("connected", { name: state?.agents[0]?.nom ?? "" }) : t("waiting")}
            {connected && state?.derniere && lastPass ? (
              <>
                {" "}
                <span className="text-muted">
                  {t("lastPass", { count: state.derniere.appliques, when: lastPass })}
                </span>
              </>
            ) : null}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Le compte gratuit voit la même prise que l'abonné : c'est le geste que
          le produit vend, et le lui cacher reviendrait à ne pas le vendre. Ce
          qui change n'est pas l'outil, c'est ce que l'agent recevra — et cela
          se dit en une ligne plutôt que sous un voile. */}
      {locked ? (
        <p className="rounded-[18px] border border-fog bg-mist px-4 py-3 text-[13px] leading-relaxed text-muted">
          {t("freeNote", { server: MCP_SERVER_NAME })}{" "}
          <Link
            href={ROUTES.pricing}
            className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-2 hover:decoration-graphite"
          >
            {t("freeCta")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
