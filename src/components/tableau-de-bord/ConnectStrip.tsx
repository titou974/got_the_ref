import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";
import { connectorFor, type SiteCapability } from "@/constants/site-platforms";
import { StatusDot } from "./Card";

/**
 * Les deux rattachements, en tête du tableau de bord.
 *
 * Google Analytics reste annoncé : le retour d'autorisation n'est pas encore
 * branché, et ouvrir un bouton qui ramène le client sur un écran d'erreur vaut
 * moins qu'une date. Le site, lui, se rattache pour de bon depuis les réglages,
 * et la carte porte l'état du lien plutôt qu'une promesse.
 *
 * Le prompt de correction, en bas de chaque page, reste la porte de sortie tant
 * qu'un rattachement manque : un « à venir » sans geste à faire se lit comme une
 * fonctionnalité absente, le même « à venir » avec le geste du jour se lit comme
 * une feuille de route.
 */

const cardClass =
  "flex flex-col gap-3 rounded-[28px] border border-border bg-surface p-5 sm:p-6";

export type ConnectedSite = {
  platform: string;
  status: string;
  capabilities: string[];
} | null;

export function ConnectStrip({ site = null }: { site?: ConnectedSite }) {
  const t = useTranslations("dashboard.connect");

  const linked = site?.status === "connected";
  const rights =
    site && site.capabilities.length > 0
      ? site.capabilities.map((capability) => t(`rights.${capability as SiteCapability}`)).join(t("rights.join"))
      : t("rights.none");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SoonCard
        title={t("analytics.title")}
        body={t("analytics.body")}
        detail={t("analytics.soonDetail")}
        badge={t("soon")}
      />

      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t("site.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("site.body")}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
            <StatusDot status={linked ? "ok" : "unknown"} />
            {linked ? t("connected") : t("notConnected")}
          </span>
        </div>

        <p className="text-sm text-muted">
          {linked && site
            ? t("site.linked", {
                platform: connectorFor(site.platform)?.name ?? site.platform,
                rights,
              })
            : t("site.detail")}
        </p>

        <Link
          href={ROUTES.dashboardSettings}
          className="mt-auto w-fit cursor-pointer rounded-pill bg-cta px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
        >
          {linked ? t("site.manage") : t("site.cta")}
        </Link>
      </div>
    </div>
  );
}

function SoonCard({
  title,
  body,
  detail,
  badge,
}: {
  title: string;
  body: string;
  detail: string;
  badge: string;
}) {
  return (
    <div className={`${cardClass} opacity-95`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
        <span className="shrink-0 rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
          {badge}
        </span>
      </div>

      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}
