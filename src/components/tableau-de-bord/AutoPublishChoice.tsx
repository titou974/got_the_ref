"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { RiCheckLine } from "@remixicon/react";
import { setAutoPublishAction } from "@/features/dashboard/actions";

/**
 * Le pilote automatique, posé en deux choix plutôt qu'en interrupteur.
 *
 * Un interrupteur intitulé « publication automatique » ne dit pas ce qu'il
 * change : les articles validés partent déjà tout seuls, coché ou non. Ce qui
 * se règle ici, c'est le degré de relecture que le client s'impose — et deux
 * phrases côte à côte le disent, là où un « on/off » demandait de deviner.
 *
 * Il vit dans les réglages, sous le rattachement du site, et non plus en tête
 * de la page Articles. C'est une règle qu'on pose une fois, à côté de la porte
 * qu'elle commande ; la page Articles, elle, ne montre plus que le planning et
 * ce qu'il attend de vous.
 */
export function AutoPublishChoice({ enabled }: { enabled: boolean }) {
  const t = useTranslations("dashboard.dock");
  const router = useRouter();
  const set = useAction(setAutoPublishAction, { onSuccess: () => router.refresh() });

  // L'état affiché suit le clic sans attendre le rechargement : le réglage est
  // instantané pour la main qui le pousse, et le serveur confirme derrière.
  const value = set.isPending ? (set.input?.autoPublish ?? enabled) : enabled;

  const options = [
    { key: false, label: t("autoOffLabel"), body: t("autoOffBody") },
    { key: true, label: t("autoOnLabel"), body: t("autoOnBody") },
  ];

  return (
    <section className="rounded-card-compact border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold">{t("autoTitle")}</h2>
      <p className="mt-0.5 text-sm text-muted">{t("autoHint")}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={String(option.key)}
              type="button"
              disabled={set.isPending}
              aria-pressed={active}
              onClick={() => set.execute({ autoPublish: option.key })}
              className={`cursor-pointer rounded-2xl border p-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:opacity-60 ${
                active ? "border-obsidian bg-mist" : "border-border bg-surface hover:border-pebble"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-obsidian bg-obsidian text-white" : "border-pebble"
                  }`}
                >
                  {active ? <RiCheckLine className="size-3" /> : null}
                </span>
                <span className="text-sm font-medium text-text">{option.label}</span>
              </span>
              <span className="mt-1.5 block pl-6 text-[13px] leading-snug text-muted">
                {option.body}
              </span>
            </button>
          );
        })}
      </div>

      {set.result.serverError ? (
        <p className="mt-2 text-sm text-danger">{set.result.serverError}</p>
      ) : null}
    </section>
  );
}
