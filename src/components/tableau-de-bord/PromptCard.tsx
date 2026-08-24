"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardTitle } from "./Card";

/**
 * Le prompt de correction, en bas de chaque section.
 *
 * Il reprend les manques réellement relevés sur le site et se colle tel quel
 * dans un agent. C'est la porte de sortie pour qui préfère faire corriger par
 * son développeur plutôt que de rattacher son site.
 */
export function PromptCard({ prompt }: { prompt: string }) {
  const t = useTranslations("dashboard.prompt");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le texte reste sélectionnable à la main */
    }
  }

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={t("hint")}
        action={
          <button
            type="button"
            onClick={copy}
            className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        }
      />
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-mist p-4 text-[13px] leading-relaxed text-ink">
        {prompt}
      </pre>
    </Card>
  );
}
