import { getTranslations } from "next-intl/server";
import { RiArrowRightUpLine, RiCheckLine, RiFlagLine } from "@remixicon/react";
import type { AnalysisProgress, ScoreDelta } from "@/features/dashboard/progress";
import { Card } from "./Card";
import { Sparkline } from "./Charts";

/**
 * Le chemin parcouru : ce que la reprise du jour a fait bouger.
 *
 * La carte n'existe qu'à partir de la deuxième mesure — avant, il n'y a pas de
 * progression à raconter, et une carte pleine de « +0 » ferait passer un début
 * pour un échec.
 *
 * Elle se lit en trois temps, du plus général au plus précis :
 *
 *   1. La règle. Une seule barre horizontale porte la note d'avant et celle
 *      d'aujourd'hui : le segment gagné est plein, ce qui restait avant est
 *      creux. C'est la figure de la carte — un client doit pouvoir dire s'il
 *      monte en un coup d'œil, sans lire un chiffre.
 *   2. Les notes qui composent la note. Architecture et contenu d'abord, ce
 *      sont les deux onglets qu'il ouvre pour corriger ; les six catégories GEO
 *      ensuite, dans l'ordre de leur poids.
 *   3. Les correctifs disparus. C'est la preuve du travail : la mesure ne les
 *      relève plus. Et ceux qui sont apparus, dits aussi franchement — un
 *      rapport qui ne montre que les bonnes nouvelles ne se croit plus.
 */
export async function AnalysisProgressCard({
  progress,
  id = "progression",
}: {
  progress: AnalysisProgress;
  id?: string;
}) {
  const t = await getTranslations("dashboard.progress");

  const { overall, sinceStart, sections, categories, resolved, appeared } = progress;
  const since = new Date(progress.previous.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  // Rien n'a bougé : ni la note, ni les deux volets, ni un seul correctif. On
  // le dit en une ligne plutôt qu'en douze lignes de zéros.
  const still =
    overall.delta === 0 &&
    sections.every((section) => section.delta === 0) &&
    categories.every((category) => category.delta === 0) &&
    resolved.length === 0 &&
    appeared.length === 0;

  return (
    <Card className="scroll-mt-24" id={id}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("since", { date: since })}</p>
        </div>
        <p className="text-sm text-ash">
          {t("sinceStart", {
            value: signed(sinceStart.delta),
            from: sinceStart.before,
          })}
        </p>
      </div>

      {still ? (
        <p className="mt-5 text-sm text-muted">{t("unchanged")}</p>
      ) : (
        <>
          {/* 1. La règle : la note d'hier, la note d'aujourd'hui, l'écart. */}
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ash">
                {t("overall")}
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-[40px] font-semibold leading-none tabular-nums">
                  {overall.after}
                </span>
                <span className="text-sm text-muted tabular-nums">
                  {t("from", { value: overall.before })}
                </span>
              </p>
            </div>
            <DeltaPill value={overall.delta} suffix={t("points")} />
            {/* La courbe des relevés, quand il y en a assez pour qu'elle dise
                quelque chose. Deux points font un trait, pas une tendance. */}
            {progress.history.length >= 3 ? (
              <div className="ml-auto text-right">
                <Sparkline
                  data={progress.history.map((point) => ({
                    date: point.date,
                    value: point.score,
                  }))}
                />
                <p className="text-xs text-ash">
                  {t("historyLabel", { count: progress.history.length })}
                </p>
              </div>
            ) : null}
          </div>

          <ProgressRule before={overall.before} after={overall.after} />

          {/* 2. Les notes qui composent la note. */}
          <div className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {[...sections, ...categories].map((row) => (
              <DeltaRow key={row.key} row={row} />
            ))}
          </div>

          {/* 3. Ce qui a disparu du plan d'action, et ce qui s'y est ajouté. */}
          {(resolved.length > 0 || appeared.length > 0) && (
            <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              {resolved.length > 0 && (
                <FixList
                  tone="resolved"
                  title={t("resolved", { count: resolved.length })}
                  items={resolved.map((item) => item.title)}
                />
              )}
              {appeared.length > 0 && (
                <FixList
                  tone="appeared"
                  title={t("appeared", { count: appeared.length })}
                  items={appeared.map((item) => item.title)}
                />
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/** « +7 » / « −3 » : le signe est écrit, jamais deviné. */
function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

/** L'écart, en pastille : vert à la hausse, rouge à la baisse, sourd à plat. */
function DeltaPill({ value, suffix }: { value: number; suffix: string }) {
  const tone =
    value > 0
      ? "bg-success/10 text-success"
      : value < 0
        ? "bg-danger/10 text-danger"
        : "bg-mist text-steel";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold tabular-nums ${tone}`}
    >
      {value > 0 ? <RiArrowRightUpLine className="size-4" aria-hidden /> : null}
      {signed(value)} {suffix}
    </span>
  );
}

/**
 * La règle : une barre où le gain se voit comme un segment.
 *
 * L'acquis d'hier est plein en gris, ce que la reprise ajoute est plein en
 * vert, et ce qui reste à prendre est creux. Une baisse se lit à l'envers : le
 * segment perdu est rouge, posé après la note d'aujourd'hui.
 */
function ProgressRule({ before, after }: { before: number; after: number }) {
  const low = Math.max(0, Math.min(100, Math.min(before, after)));
  const high = Math.max(0, Math.min(100, Math.max(before, after)));
  const gained = after >= before;

  return (
    <div
      className="mt-4 flex h-2 w-full overflow-hidden rounded-pill bg-fog"
      role="img"
      aria-label={`${before} → ${after}`}
    >
      <span className="h-full bg-graphite" style={{ width: `${low}%` }} />
      <span
        className={`h-full ${gained ? "bg-success" : "bg-danger"}`}
        style={{ width: `${high - low}%` }}
      />
    </div>
  );
}

/** Une ligne de note : l'intitulé, le passage d'un chiffre à l'autre, l'écart. */
function DeltaRow({ row }: { row: ScoreDelta }) {
  const moved = row.delta !== 0;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0">
      <span className="min-w-0 truncate text-sm text-text">{row.label}</span>
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        <span className="text-sm text-ash">{row.before}</span>
        <span aria-hidden className="text-ash">
          →
        </span>
        <span className="text-sm font-semibold">{row.after}</span>
        <span
          className={`w-10 text-right text-xs font-semibold ${
            !moved ? "text-ash" : row.delta > 0 ? "text-success" : "text-danger"
          }`}
        >
          {signed(row.delta)}
        </span>
      </span>
    </div>
  );
}

/** Les correctifs partis, ou arrivés. Cinq au plus : la carte n'est pas le plan. */
function FixList({
  tone,
  title,
  items,
}: {
  tone: "resolved" | "appeared";
  title: string;
  items: string[];
}) {
  const shown = items.slice(0, 5);
  const rest = items.length - shown.length;
  const Icon = tone === "resolved" ? RiCheckLine : RiFlagLine;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ash">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {shown.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-text">
            <Icon
              className={`mt-1 size-4 shrink-0 ${
                tone === "resolved" ? "text-success" : "text-warning"
              }`}
              aria-hidden
            />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="mt-1.5 text-xs text-ash">+ {rest}</p> : null}
    </div>
  );
}
