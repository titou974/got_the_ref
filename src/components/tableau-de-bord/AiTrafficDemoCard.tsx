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
import { Obscured, Redacted } from "@/components/dashboard/LockedContent";
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
 * Le compte de démonstration fait exception (`showcase`) : il sert à montrer
 * l'écran fini, bandeau et panneau de rattachement retirés.
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
  showcase = false,
  overlay,
}: {
  demo: DemoAiTraffic;
  domain: string | null;
  /**
   * La carte est posée sous une offre qui ne l'ouvre pas encore.
   *
   * Elle garde alors tout ce qui la rend lisible — le titre, la barre de
   * période, les trois onglets avec leurs logos, l'axe des dates — et ne retient
   * que deux choses : les totaux, écrits « X », et la courbe, floutée. C'est la
   * seule part qui répond vraiment à la question posée, et la seule qui
   * s'achète. L'appel de l'offre, lui, arrive par `overlay` et se pose sur la
   * courbe : c'est là que le voile se voit, donc là qu'il faut dire comment le
   * lever.
   */
  veiled?: boolean;
  /**
   * Le compte de démonstration : la carte se montre finie.
   *
   * Ni bandeau « données d'exemple » ni panneau de rattachement — la courbe
   * occupe la carte seule, comme sur un compte branché. C'est l'écran qu'on
   * fait voir en démonstration, pas celui d'un client en attente de
   * branchement.
   */
  showcase?: boolean;
  /** L'appel de l'offre, posé par-dessus la courbe floutée. */
  overlay?: React.ReactNode;
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
          showcase ? undefined : (
            <span className="inline-flex items-center rounded-pill border border-border bg-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
              {t("demoBadge")}
            </span>
          )
        }
      />

      {/* Sans offre pour l'ouvrir, la carte reste entière et seule la courbe se
          floute : le client lit la période, les trois assistants suivis et la
          forme de l'écran, sans lire un chiffre. En attente de rattachement,
          c'est l'inverse — l'exemple est inventé de bout en bout, donc tout
          passe sous le voile, et le panneau de rattachement se pose dessus. */}
      <div className="relative isolate mt-4">
        <Veiled on={!veiled}>
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
              redacted={veiled}
            />

            <div className="p-4 sm:p-5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {veiled ? null : <Delta value={changeOf(engine)} />}
                <span>{t("vsPrevious", { days: view.days })}</span>
                {/* Sur téléphone, la part passe à la ligne : la puce y ouvrirait
                    la ligne comme une liste à points. */}
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <span>
                  {veiled
                    ? t("shareMasked")
                    : t("share", {
                        value:
                          share < 1
                            ? share.toFixed(1)
                            : String(Math.round(share)),
                      })}
                </span>
              </p>

              {/* Sur téléphone, la courbe perd ce qui ne tient pas dans la
                  largeur : l'axe des ordonnées et toutes les dates sauf les
                  deux bouts. */}
              {/* L'appel se pose sur la courbe, la seule part retenue : le
                  titre, la période et les onglets restent lisibles au-dessus.
                  La hauteur minimale lui garde sa place : sur un téléphone, la
                  courbe fait 224 px et le panneau y serait à l'étroit. */}
              <div className={`relative isolate ${veiled ? "min-h-[17rem]" : ""}`}>
                <Veiled on={veiled}>
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
                </Veiled>
                {veiled ? overlay : null}
              </div>
            </div>
          </div>
        </Veiled>

        {veiled || showcase ? null : <ConnectOverlay />}
      </div>

      <p className="mt-4 text-xs text-ash">{t("geminiNote")}</p>
    </Card>
  );
}

/** Floute son contenu, ou le laisse tel quel. Deux états, un seul balisage. */
function Veiled({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return <Obscured>{children}</Obscured>;
}

/**
 * Le voile posé sur l'exemple : ce qu'il faudra rattacher, et quand.
 *
 * Les deux boutons sont désactivés et le disent — ni l'un ni l'autre n'ouvre
 * quoi que ce soit aujourd'hui. Un bouton actif qui mènerait à un écran vide
 * coûterait au client un aller-retour pour apprendre la même chose.
 *
 * Google Analytics compte les visites déjà mesurées ; Tag Manager pose la
 * mesure sur un site qui n'en a pas. Les deux sont là parce que les clients
 * arrivent avec l'un ou l'autre, rarement les deux.
 */
function ConnectOverlay() {
  const t = useTranslations("dashboard.traffic");

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-fog bg-snow/95 p-5 text-center shadow-[var(--shadow-md)] backdrop-blur-sm">
        <span className="inline-flex items-center rounded-pill bg-mist px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
          {t("locked.badge")}
        </span>

        <p className="mt-3 font-semibold">{t("locked.title")}</p>

        <div className="mt-4 flex flex-col gap-2">
          <ConnectButton label={t("locked.analytics")} />
          <ConnectButton label={t("locked.tagManager")} />
        </div>
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
  redacted = false,
}: {
  engines: DemoEngineSummary[];
  selected: DemoEngine;
  onSelect: (engine: DemoEngine) => void;
  /** Le total de chaque assistant est retenu : « X » prend sa place. */
  redacted?: boolean;
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
              {redacted ? (
                <Redacted label={`visites depuis ${item.name}, masquées`} />
              ) : (
                formatVisits(item.sessions)
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
