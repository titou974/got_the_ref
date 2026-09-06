"use client";

import { useTranslations } from "next-intl";
import type { SiteConnector } from "@/constants/site-platforms";

/**
 * Le mode d'emploi de la plateforme choisie, au-dessus des champs.
 *
 * On ne demande pas un mot de passe d'application ou un jeton Admin à un
 * commerçant sans lui dire où le prendre : c'est le seul endroit du produit où
 * il doit aller cliquer ailleurs que chez nous, et c'est là que le rattachement
 * se perd. Les étapes sont donc écrites dans les mots de l'écran qu'il a sous
 * les yeux — le nom exact des menus, dans l'ordre où il les rencontre.
 *
 * Le texte vit dans les traductions (`dashboard.settings.site.guides`), pas
 * ici : il change quand Shopify renomme un menu, pas quand le code change.
 */
export function SiteConnectGuide({ connector }: { connector: SiteConnector }) {
  const t = useTranslations("dashboard.settings.site");

  const key = `guides.${connector.id}`;
  if (!t.has(`${key}.steps`)) return null;

  const steps = t.raw(`${key}.steps`) as string[];
  const caution = t.has(`${key}.caution`) ? t(`${key}.caution`) : null;

  return (
    <div className="rounded-2xl border border-border bg-mist/40 p-4">
      <p className="text-sm font-medium text-text">{t("guideTitle", { name: connector.name })}</p>

      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-6 text-muted">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-obsidian/10 text-[11px] font-semibold tabular-nums text-graphite">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {caution ? <p className="mt-3 text-sm text-graphite">{caution}</p> : null}

      {connector.docsUrl ? (
        <a
          href={connector.docsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-block text-sm font-medium text-graphite underline underline-offset-4 transition-colors duration-200 hover:text-obsidian"
        >
          {t("docs")}
        </a>
      ) : null}
    </div>
  );
}
