"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AreaChart } from "@/components/tremor/AreaChart";
import {
  windowDemoAiTraffic,
  type DemoAiTraffic,
  type DemoEngine,
  type DemoEngineSummary,
} from "@/features/dashboard/demoTraffic";
import { useIsCompact } from "@/lib/useIsCompact";
import { cx } from "@/lib/utils";
import { Card, CardTitle, Delta } from "./Card";
import { TrafficFilterBar, type TrafficPeriod } from "./TrafficFilterBar";

/**
 * La carte de trafic en mode exemple : un onglet par assistant, son logo et son
 * total en tête, sa courbe en dessous.
 *
 * Reprise du bloc « web analytics » de Tremor. Le choix des onglets plutôt que
 * de trois aires empilées vient de ce que le client cherche ici : il veut savoir
 * ce que ChatGPT lui amène, pas ce que les trois amènent ensemble — et sur des
 * volumes aussi éloignés, la part de Perplexity disparaîtrait sous celle de
 * ChatGPT dans un empilement.
 *
 * Le bandeau « données d'exemple » n'est pas décoratif : ces visites sont
 * inventées, et une courbe crédible sans mention se lirait comme une mesure.
 */

/** Le logo et la couleur de courbe de chaque assistant, dans l'ordre du tableau. */
const ENGINES: Record<
  DemoEngine,
  { logo: string; color: "ink" | "ember" | "orchid" }
> = {
  ChatGPT: { logo: "/chatgpt.png", color: "ink" },
  Gemini: { logo: "/gemini.webp", color: "ember" },
  Perplexity: { logo: "/perplexity.png", color: "orchid" },
};

const numberFormatter = new Intl.NumberFormat("fr-FR");

const formatVisits = (value: number) => numberFormatter.format(value);

const changeOf = (engine: DemoEngineSummary) =>
  engine.previousSessions > 0
    ? ((engine.sessions - engine.previousSessions) / engine.previousSessions) *
      100
    : null;

export function AiTrafficDemoCard({
  demo,
  domain,
}: {
  demo: DemoAiTraffic;
  domain: string | null;
}) {
  const t = useTranslations("dashboard.traffic");
  const compact = useIsCompact();
  const [period, setPeriod] = useState<TrafficPeriod>(30);
  const [selected, setSelected] = useState<DemoEngine>("ChatGPT");

  // Les trente jours sont déjà chargés : changer de période ne recompte que ce
  // qui est là, sans aller-retour serveur.
  const view = useMemo(() => windowDemoAiTraffic(demo, period), [demo, period]);

  const engine =
    view.engines.find((item) => item.name === selected) ?? view.engines[0];
  const share = (engine.sessions / view.siteSessions) * 100;

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={t("hint")}
        action={
          <span className="inline-flex items-center rounded-pill border border-border bg-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
            {t("demoBadge")}
          </span>
        }
      />

      {/* La barre de filtres, les onglets et la courbe restent manipulables :
          l'exemple sert à montrer l'écran en fonctionnement, pas seulement sa
          mise en page. Le bandeau « données d'exemple » porte seul l'avertissement. */}
      <div className="mt-4">
        <TrafficFilterBar
          domain={domain}
          period={period}
          onPeriodChange={setPeriod}
        />

        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <EngineTabs
            engines={view.engines}
            selected={selected}
            onSelect={setSelected}
          />

          <div className="p-4 sm:p-5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <Delta value={changeOf(engine)} />
              <span>{t("vsPrevious", { days: view.days })}</span>
              {/* Sur téléphone, la part passe à la ligne : la puce y ouvrirait
                  la ligne comme une liste à points. */}
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span>
                {t("share", {
                  value:
                    share < 1 ? share.toFixed(1) : String(Math.round(share)),
                })}
              </span>
            </p>

            {/* Sur téléphone, la courbe perd ce qui ne tient pas dans la
                largeur : l'axe des ordonnées et toutes les dates sauf les
                deux bouts. */}
            <AreaChart
              data={view.series}
              index="date"
              categories={[engine.name]}
              colors={[ENGINES[engine.name].color]}
              valueFormatter={formatVisits}
              showLegend={false}
              showYAxis={!compact}
              startEndOnly={compact}
              yAxisWidth={44}
              className={compact ? "mt-4 h-56" : "mt-4 h-72"}
            />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-ash">{t("geminiNote")}</p>
    </Card>
  );
}

/**
 * La rangée d'onglets : logo, nom, total.
 *
 * Les flèches gauche et droite déplacent la sélection, comme dans tout jeu
 * d'onglets : sans elles, la tabulation obligerait à traverser les trois pour
 * atteindre le troisième.
 */
function EngineTabs({
  engines,
  selected,
  onSelect,
}: {
  engines: DemoEngineSummary[];
  selected: DemoEngine;
  onSelect: (engine: DemoEngine) => void;
}) {
  const move = (step: number) => {
    const index = engines.findIndex((item) => item.name === selected);
    const next = engines[(index + step + engines.length) % engines.length];
    onSelect(next.name);
  };

  return (
    <div role="tablist" className="flex overflow-x-auto bg-mist">
      {engines.map((item, index) => {
        const active = item.name === selected;

        return (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(item.name)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft")
                return;
              event.preventDefault();
              move(event.key === "ArrowRight" ? 1 : -1);
            }}
            className={cx(
              // Les trois onglets se partagent la largeur plutôt que de
              // déborder : sur un téléphone, un troisième onglet coupé au bord
              // ne se voit pas, et rien n'invite à faire défiler une rangée.
              "min-w-0 flex-1 cursor-pointer whitespace-nowrap px-2.5 py-3 text-left transition-colors duration-200 sm:px-5 sm:py-3.5",
              index > 0 ? "border-l border-border" : "",
              active ? "bg-surface" : "hover:bg-fog",
            )}
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <Image
                src={ENGINES[item.name].logo}
                alt=""
                aria-hidden
                width={32}
                height={32}
                className="h-4 w-4 shrink-0 rounded-[5px] object-contain"
              />
              <span
                className={cx(
                  // 11 px sur téléphone : « Perplexity » y tient en entier, là
                  // où 12 px le coupe au milieu.
                  "truncate text-[11px] sm:text-sm",
                  active ? "text-ink" : "text-muted",
                )}
              >
                {item.name}
              </span>
            </span>
            <span className="mt-1 block text-xl font-bold tabular-nums sm:text-2xl">
              {formatVisits(item.sessions)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
