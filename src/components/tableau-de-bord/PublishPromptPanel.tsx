"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Le prompt de publication d'un article, une fois demandé.
 *
 * Même forme que la modale « résoudre avec les agents IA » : les logos des
 * agents au-dessus, à gauche, pour dire où le coller ; le texte en extrait qui
 * s'éteint en dégradé ; le bouton de copie en tête. Un client qui a appris le
 * geste sur l'accueil le retrouve ici sans réapprendre.
 */

const COPIED_MS = 2000;

/** Les agents dans lesquels le prompt se colle, comme sur la barre « résoudre ». */
const AGENTS = [
  { name: "ChatGPT", logo: "/chatgpt.png" },
  { name: "Claude", logo: "/claude.svg" },
] as const;

export function PublishPromptPanel({ prompt }: { prompt: string }) {
  const t = useTranslations("dashboard.article");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : rien à annoncer.
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5" aria-hidden>
            {AGENTS.map((agent) => (
              <Image
                key={agent.name}
                src={agent.logo}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 rounded-[4px] object-contain"
              />
            ))}
          </span>
          <span className="text-sm font-medium">{t("publishPromptTitle")}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="cursor-pointer rounded-pill bg-cta px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
        >
          {copied ? t("publishPromptCopied") : t("publishPromptCopy")}
        </button>
      </div>

      <p className="mt-1 text-xs text-muted">{t("publishPromptHint")}</p>

      <div className="relative mt-3">
        <pre className="max-h-48 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-fog bg-mist px-4 py-3 font-sans text-[11px] leading-relaxed text-muted">
          {prompt}
        </pre>
        {/* Le texte s'éteint vers le bas : c'est un extrait, et une coupe nette
            se lirait comme un prompt tronqué à la copie. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-px bottom-px h-16 rounded-b-xl bg-gradient-to-b from-transparent to-mist"
        />
      </div>
    </div>
  );
}
