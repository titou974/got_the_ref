"use client";

import { useTranslations } from "next-intl";
import { StackMark } from "@/components/StackMark";
import { SITE_CONNECTORS, type SiteConnector } from "@/constants/site-platforms";

/**
 * Première étape du rattachement : sur quoi tourne le site.
 *
 * Une liste déroulante posait la question sans y répondre — le client devait
 * l'ouvrir pour découvrir ce qu'on sait faire, et rien n'y distinguait une
 * plateforme rattachable d'une plateforme seulement écrite. Les tuiles disent
 * les deux d'un coup d'œil : ce qui est ouvert se clique, le reste est grisé et
 * daté.
 *
 * L'ordre suit l'état, pas le registre : WordPress et Shopify d'abord, le reste
 * ensuite. Un client qui tombe d'abord sur quatre cases grisées croit que le
 * produit ne marche pas.
 */
export function SitePlatformPicker({
  detected,
  dense = false,
  onPick,
}: {
  /** La plateforme reconnue au crawl : signalée, jamais choisie d'office. */
  detected: string | null;
  /** Deux colonnes plutôt que trois : la variante servie dans la modale. */
  dense?: boolean;
  onPick: (platform: string) => void;
}) {
  const t = useTranslations("dashboard.settings.site");

  // `sort` est stable : à état égal, l'ordre du registre est conservé.
  const tiles = [...SITE_CONNECTORS].sort((a, b) => Number(b.ready) - Number(a.ready));

  return (
    <div>
      <p className="text-sm font-medium text-text">{t("pickTitle")}</p>
      <p className="mt-1 text-sm text-muted">{t("pickBody")}</p>

      <ul
        className={`mt-4 grid gap-2 ${dense ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {tiles.map((connector) => (
          <li key={connector.id}>
            <Tile
              connector={connector}
              detected={connector.ready && connector.id === detected}
              onPick={onPick}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tile({
  connector,
  detected,
  onPick,
}: {
  connector: SiteConnector;
  detected: boolean;
  onPick: (platform: string) => void;
}) {
  const t = useTranslations("dashboard.settings.site");

  return (
    <button
      type="button"
      disabled={!connector.ready}
      onClick={() => onPick(connector.id)}
      className={`flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors duration-200 ${
        connector.ready
          ? "cursor-pointer border-obsidian/20 bg-snow hover:border-obsidian hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/30"
          : "cursor-not-allowed border-fog bg-mist/50 text-muted"
      }`}
    >
      {/* « Autre site » n'a pas de marque : un globe tient sa place, sinon la
          tuile se lit comme un logo qui n'a pas chargé. */}
      {connector.id === "custom" ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0 text-ash"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      ) : (
        <StackMark
          id={connector.id}
          size={22}
          className={connector.ready ? "text-text" : "text-ash"}
        />
      )}
      <span className="text-sm font-medium">{connector.name}</span>

      {connector.ready ? (
        detected ? (
          <span className="rounded-pill bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            {t("pickDetected")}
          </span>
        ) : null
      ) : (
        <span className="rounded-pill bg-obsidian/10 px-2 py-0.5 text-[11px] font-semibold text-graphite">
          {t("pickSoon")}
        </span>
      )}
    </button>
  );
}
