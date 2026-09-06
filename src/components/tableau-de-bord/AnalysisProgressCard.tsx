import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react";
import type { AnalysisProgress, EngineProgress } from "@/features/dashboard/progress";
import { ENGINE_LOGOS } from "@/constants/engine-logos";
import { Card } from "./Card";

/**
 * Le chemin parcouru : est-ce que ça monte, et sur quels moteurs.
 *
 * La carte répond à deux questions, pas une de plus. Une barre porte la note de
 * visibilité — d'où elle part, où elle en est — et quatre cartes disent, moteur
 * par moteur, si la place gagnée l'a été chez ChatGPT, Gemini, Perplexity ou
 * Claude. Le détail des correctifs, lui, vit dans le plan d'action : une carte
 * de progression qui listait aussi les points relevés donnait à lire deux
 * écrans à la fois, et laissait croire à un travail fait là où la mesure avait
 * seulement bougé.
 *
 * Elle n'existe qu'à partir de la deuxième mesure — avant, il n'y a pas de
 * progression à raconter, et une carte pleine de « 0 » ferait passer un début
 * pour un échec.
 *
 * Un zéro, ici, est une information et non un défaut : les notes ne sont
 * reprises que lorsque la page lue a changé (voir `signalsFingerprint`), donc
 * une journée sans correction se lit « 0 » partout. C'est la condition pour
 * qu'un « +4 » veuille dire quelque chose.
 */
export async function AnalysisProgressCard({
  progress,
  id = "progression",
}: {
  progress: AnalysisProgress;
  id?: string;
}) {
  const t = await getTranslations("dashboard.progress");

  const { overall, sinceStart, engines } = progress;
  const day = (value: Date) =>
    new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  const still = overall.delta === 0 && engines.every((engine) => engine.delta === 0);

  return (
    <Card className="scroll-mt-24" id={id}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {t("since", { date: day(progress.previous.createdAt) })}
          </p>
        </div>
        <p className="text-sm text-ash">
          {t("sinceStart", { value: signed(sinceStart.delta), from: sinceStart.before })}
        </p>
      </div>

      {/* La note, son écart, et la barre qui les tient ensemble. */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-[40px] font-semibold leading-none tabular-nums">
          {overall.after}
        </span>
        <span className="text-sm text-muted">{t("overall")}</span>
        <span className="ml-auto">
          <DeltaPill value={overall.delta} suffix={t("points")} />
        </span>
      </div>

      <ProgressRule before={overall.before} after={overall.after} />

      <div className="mt-2 flex justify-between text-xs text-ash tabular-nums">
        <span>{t("before", { value: overall.before, date: day(progress.previous.createdAt) })}</span>
        <span>{t("now", { value: overall.after })}</span>
      </div>

      {still ? <p className="mt-5 text-sm text-muted">{t("unchanged")}</p> : null}

      {/* Un moteur par carte. Le nom, le logo, l'écart : rien d'autre. */}
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ash">
          {t("enginesTitle")}
        </p>
        {engines.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {engines.map((engine) => (
              <EngineDeltaCard
                key={engine.engine}
                engine={engine}
                caption={
                  engine.delta > 0
                    ? t("engineUp")
                    : engine.delta < 0
                      ? t("engineDown")
                      : t("engineFlat")
                }
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("enginesPending")}</p>
        )}
      </div>
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
      {value > 0 ? <RiArrowUpLine className="size-4" aria-hidden /> : null}
      {value < 0 ? <RiArrowDownLine className="size-4" aria-hidden /> : null}
      {signed(value)} {suffix}
    </span>
  );
}

/**
 * La barre : l'acquis, puis le segment que la reprise ajoute ou retire.
 *
 * Ce qui était déjà tenu est plein en gris ; ce que la mesure ajoute est vert,
 * ce qu'elle retire est rouge, et la rupture de couleur marque à elle seule la
 * note d'avant — un repère de plus posé au même endroit ne dirait rien de neuf.
 */
function ProgressRule({ before, after }: { before: number; after: number }) {
  const low = Math.max(0, Math.min(100, Math.min(before, after)));
  const high = Math.max(0, Math.min(100, Math.max(before, after)));
  const gained = after >= before;

  return (
    <div
      className="mt-4 flex h-2.5 w-full overflow-hidden rounded-pill bg-fog"
      role="img"
      aria-label={`${before} sur 100 avant, ${after} sur 100 aujourd'hui`}
    >
      <span className="h-full bg-graphite" style={{ width: `${low}%` }} />
      <span
        className={`h-full ${gained ? "bg-success" : "bg-danger"}`}
        style={{ width: `${high - low}%` }}
      />
    </div>
  );
}

/** Un moteur, son écart. Le rang exact se lit dans la section « Classements IA ». */
function EngineDeltaCard({
  engine,
  caption,
}: {
  engine: EngineProgress;
  caption: string;
}) {
  const logo = ENGINE_LOGOS[engine.engine];
  const tone =
    engine.delta > 0 ? "text-success" : engine.delta < 0 ? "text-danger" : "text-steel";

  return (
    <div className="rounded-[20px] bg-mist p-4">
      <div className="flex items-center gap-2">
        {logo ? (
          <Image
            src={logo}
            alt=""
            width={24}
            height={24}
            className="h-5 w-5 shrink-0 rounded"
          />
        ) : null}
        <span className="truncate text-[15px] font-semibold">{engine.engine}</span>
      </div>
      <p className={`mt-3 text-[28px] font-semibold leading-none tabular-nums ${tone}`}>
        {signed(engine.delta)}
      </p>
      <p className="mt-1 text-[13px] text-muted">{caption}</p>
    </div>
  );
}
