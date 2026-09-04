"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/tremor/Select";
import { SiteFavicon } from "./SiteFavicon";

/**
 * Le site suivi, en haut de la colonne de gauche.
 *
 * La carte « Projet : domaine » qui occupait cette place ne faisait que
 * répéter une ligne. Le sélecteur dit la même chose et annonce la suite : un
 * compte pourra suivre plusieurs sites. « Ajouter un site » est donc présent
 * mais désactivé — l'entrée grisée montre où le geste se fera, sans ouvrir un
 * écran qui n'existe pas encore, et une ligne dessous annonce l'échéance et
 * l'offre qui l'ouvrira.
 *
 * Le domaine sert d'identifiant à l'entrée : sans deuxième site, il n'y a rien
 * à changer, et le sélecteur reste un affichage qu'on peut ouvrir.
 */
export function SiteSelect({ domain }: { domain: string | null }) {
  const t = useTranslations("dashboard");

  if (!domain) {
    return (
      <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
        {t("noProject")}
      </p>
    );
  }

  return (
    <Select value={domain}>
      <SelectTrigger aria-label={t("siteSelect.label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectGroupLabel>{t("siteSelect.label")}</SelectGroupLabel>
          <SelectItem value={domain}>
            <span className="flex w-full items-center gap-x-2.5">
              <SiteFavicon domain={domain} />
              <span className="truncate">{domain}</span>
            </span>
          </SelectItem>
          <SelectItem value="__add__" disabled>
            <span className="flex w-full items-start gap-x-2.5">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-dashed border-pebble text-[13px] leading-none"
              >
                +
              </span>
              <span className="min-w-0">
                <span className="block truncate">{t("siteSelect.add")}</span>
                {/* L'entrée grisée dit où le geste se fera ; cette ligne dit
                    quand, et à quelles conditions. Sans elle, « Ajouter un
                    site » se lit comme une panne plutôt que comme une suite. */}
                <span className="mt-0.5 block text-xs leading-4 text-muted">
                  {t("siteSelect.addSoon")}
                </span>
              </span>
            </span>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
