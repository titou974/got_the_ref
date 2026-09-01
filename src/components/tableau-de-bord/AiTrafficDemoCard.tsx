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
  veiled = false,
  offerCall,
}: {
  demo: DemoAiTraffic;
  domain: string | null;
  /**
   * La carte est posée sous une offre qui ne l'ouvre pas encore.
   *
   * Elle reste entière et lisible — ces visites sont inventées, il n'y a rien à
   * retenir derrière un voile. Seul change l'appel posé sous la courbe : celui
   * de l'offre quand elle ne l'ouvre pas, celui du rattachement Analytics sinon.
   */
  veiled?: boolean;
  /**
   * L'appel de l'offre, rendu **en flux** sous la courbe.
   *
   * Il attend donc une barre (`GateBar`), pas un panneau posé en absolu
   * (`GatePanel`) : celui-ci se cale sur son parent positionné et, dans un
   * conteneur en flux, il irait se coller au premier ancêtre `relative` venu.
   */
  offerCall?: React.ReactNode;
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

      {/* La courbe d'exemple se lit en clair, quel que soit l'état de l'offre.
          Elle était floutée dans les deux cas — sous une offre qui ne l'ouvre
          pas, et en attente de rattachement Analytics — et c'était flouter une
          démonstration : ces visites sont inventées, il n'y a pas de mesure à
          retenir derrière le voile. Un client qui ne voit qu'un brouillard gris
          n'apprend pas ce que la carte lui montrera une fois branchée, et c'est
          pourtant la seule chose que cette carte a à dire.
          Ce qui reste, et qui suffit : le bandeau « données d'exemple » en tête,
          et l'appel — rattachement ou offre — posé sous la courbe plutôt que
          dessus. */}
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
                  value: share < 1 ? share.toFixed(1) : String(Math.round(share)),
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

        {/* L'appel, sous la courbe. Sous une offre qui n'ouvre pas encore le
            trafic, c'est celui de l'offre ; sinon, c'est le rattachement. */}
        <div className="mt-4">{veiled ? offerCall : <ConnectPanel />}</div>
      </div>

      <p className="mt-4 text-xs text-ash">{t("geminiNote")}</p>
    </Card>
  );
}

/**
 * Ce qu'il faudra rattacher pour que la courbe devienne une mesure.
 *
 * Le panneau se pose sous la courbe et non plus dessus : la courbe d'exemple se
 * lit désormais en clair, et un calque posé par-dessus la recouvrirait aussi
 * sûrement que le flou qu'il remplace.
 *
 * Les deux boutons sont désactivés et le disent — ni l'un ni l'autre n'ouvre
 * quoi que ce soit aujourd'hui. Un bouton actif qui mènerait à un écran vide
 * coûterait au client un aller-retour pour apprendre la même chose.
 *
 * Google Analytics compte les visites déjà mesurées ; Tag Manager pose la
 * mesure sur un site qui n'en a pas. Les deux sont là parce que les clients
 * arrivent avec l'un ou l'autre, rarement les deux.
 */
function ConnectPanel() {
  const t = useTranslations("dashboard.traffic");

  return (
    <div className="rounded-3xl border border-fog bg-snow p-5 text-center">
      <span className="inline-flex items-center rounded-pill bg-mist px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
        {t("locked.badge")}
      </span>

      <p className="mt-3 font-semibold">{t("locked.title")}</p>

      <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2">
        <ConnectButton label={t("locked.analytics")} />
        <ConnectButton label={t("locked.tagManager")} />
      </div>
    </div>
  );
}

/** Un rattachement annoncé, pas encore ouvert. */
function ConnectButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-pill border border-border bg-surface px-4 py-2.5 text-sm font-medium text-graphite opacity-70"
    >
      <GoogleMark />
      {label}
    </button>
  );
}

/** Le « G » de Google, dans ses quatre couleurs. */
function GoogleMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1Z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C7.9 40.8 15.4 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.3-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 7.9 7.2 4.4 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1Z"
      />
    </svg>
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
