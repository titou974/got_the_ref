"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { EngineRanking, EngineScore } from "@/lib/geo/types";
import { decoyRanking } from "@/lib/geo/decoy-ranking";
import { scoreColor, visibilityColor } from "@/lib/score";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { LockedPill, Obscured, Redacted } from "@/components/dashboard/LockedContent";

/**
 * Le classement d'un commerce dans chaque moteur, carte par carte.
 *
 * C'est le bloc central du rapport, et c'est aussi celui que le client vient
 * revoir chaque semaine dans son tableau de bord : les deux écrans partagent
 * donc le même composant. Verrouillé, la carte garde son en-tête net — on doit
 * voir QUEL moteur a répondu — et ne floute que la mesure.
 */

/**
 * Le nombre de bandes fictives d'une carte de démonstration : un top 10 entier,
 * la longueur d'un vrai classement. Une liste plus courte se verrait à travers
 * le voile — la carte serait plus basse que sa jumelle ouverte.
 */
const PREVIEW_DECOY_COUNT = 10;

/** Logos des moteurs IA (chemins dans /public), indexés par nom de moteur. */
import { ENGINE_LOGOS } from "@/constants/engine-logos";

// Ré-exporté ici pour ne pas casser les appelants clients qui le lisaient déjà
// à cette adresse. La table elle-même vit dans un module neutre : un composant
// serveur ne peut pas lire un objet exporté depuis un module « use client ».
export { ENGINE_LOGOS };

/**
 * D'où vient ce top 10, dit en une ligne sous le classement.
 *
 * Trois états, et ils ne se valent pas. Un relevé du jour est ce que le moteur
 * répond maintenant. Un relevé plus ancien reste un relevé — il est gardé tel
 * quel quand l'API n'a pas répondu, plutôt que remplacé par autre chose — mais
 * le client doit lire sa date pour ne pas le prendre pour une position
 * d'aujourd'hui. Une estimation, enfin, n'est pas un classement : elle vient de
 * la connaissance du marché par le modèle d'audit, et le dire est la seule
 * façon de garder la confiance sur les deux premiers cas.
 */
function RankingSource({ ranking }: { ranking: EngineRanking }) {
  if (!ranking.measured) {
    return (
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Estimation de marché, pas un relevé : aucun moteur n&apos;a répondu sur cette requête.
      </p>
    );
  }

  const measuredAt = ranking.measuredAt ? new Date(ranking.measuredAt) : null;
  if (!measuredAt || Number.isNaN(measuredAt.getTime())) return null;

  const sameDay = new Date().toDateString() === measuredAt.toDateString();
  if (sameDay) return null;

  return (
    <p className="mt-2 text-[11px] leading-relaxed text-muted">
      Relevé du{" "}
      {measuredAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}{" "}
      : le moteur n&apos;a pas répondu depuis, ce classement est conservé tel quel.
    </p>
  );
}

/**
 * Un classement (direct ou indirect) d'un moteur, avec le commerce surligné.
 * Verrouillé, les vraies lignes cèdent la place à des bandes fictives : on doit
 * voir qu'un classement existe, sans pouvoir y repérer sa propre position.
 */
export function RankingList({
  ranking,
  locked = false,
  decoyCount,
}: {
  ranking: EngineRanking;
  locked?: boolean;
  /** Nombre de bandes fictives une fois verrouillé. Par défaut, celui du lib. */
  decoyCount?: number;
}) {
  const t = useTranslations("analysisReport.results");
  const scopeLabel = ranking.scope === "direct" ? t("directScope") : t("indirectScope");
  const isDirect = ranking.scope === "direct";

  return (
    <div className="rounded-2xl border border-fog bg-mist p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={
              isDirect
                ? { background: "rgba(9,9,11,0.08)", color: "var(--color-obsidian)" }
                : { background: "rgba(113,113,122,0.12)", color: "#52525b" }
            }
          >
            {scopeLabel}
          </span>
          <p className="mt-1 truncate text-xs text-muted">{ranking.label}</p>
        </div>
        {locked ? (
          // Même « non classé » est une information : on n'en dit rien. Le rang
          // s'écrit « #X », comme partout ailleurs où une valeur est retenue.
          <span className="shrink-0 rounded-lg bg-fog px-2 py-0.5 text-sm font-bold text-ash">
            #<Redacted label="rang masqué" />
          </span>
        ) : ranking.targetRank != null ? (
          <span className="shrink-0 rounded-lg bg-obsidian/10 px-2 py-0.5 text-sm font-bold text-obsidian">
            #{ranking.targetRank}
          </span>
        ) : (
          <span className="shrink-0 rounded-lg bg-fog px-2 py-0.5 text-[11px] font-medium text-muted">
            {t("notRanked")}
          </span>
        )}
      </div>
      {locked ? (
        // Les bandes sont fictives, et elles se floutent quand même : nettes,
        // elles se liraient comme le classement réel du client.
        <Obscured strength="sm">
          <DecoyBands seedKey={`${ranking.label}|${ranking.scope}`} count={decoyCount} />
        </Obscured>
      ) : ranking.competitors.length > 0 ? (
        <ol className="space-y-0.5">
          {ranking.competitors.map((c) => (
            <li
              key={`${c.rank}-${c.name}`}
              className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                c.isTarget ? "bg-obsidian/[0.06] ring-1 ring-inset ring-obsidian/20" : ""
              }`}
            >
              <span
                className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${
                  c.isTarget ? "text-obsidian" : "text-muted"
                }`}
              >
                {c.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  c.isTarget ? "font-semibold text-text" : "text-text"
                }`}
              >
                {c.name}
                {c.isTarget && (
                  <span className="ml-1.5 text-[10px] font-semibold text-obsidian">{t("you")}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted">{t("noRankingData")}</p>
      )}

      {/* Verrouillé, les lignes sont fictives : annoncer leur provenance n'aurait
          aucun sens, et daterait un classement que le visiteur ne voit pas. */}
      {!locked && <RankingSource ranking={ranking} />}
    </div>
  );
}

/**
 * Bandes de classement fictives : des rangs, des noms, aucune ligne « vous ».
 * C'est ce qui remplace le classement réel sur l'aperçu gratuit.
 */
function DecoyBands({ seedKey, count }: { seedKey: string; count?: number }) {
  const entries = decoyRanking(seedKey, count);
  return (
    <ol className="space-y-0.5">
      {entries.map((e) => (
        <li
          key={e.rank}
          className="flex items-center gap-2 rounded-md px-2 py-1 odd:bg-obsidian/[0.03]"
        >
          <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted">
            {e.rank}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-text">{e.name}</span>
        </li>
      ))}
    </ol>
  );
}

export function EngineCard({
  engine,
  delay,
  locked = false,
  compact = false,
  preview = false,
  overlay,
}: {
  engine: EngineScore;
  delay: number;
  /** Verrouillé : le moteur et son nom restent lisibles, la mesure est floutée. */
  locked?: boolean;
  /**
   * Version resserrée, celle du tableau de bord.
   *
   * Le rapport d'analyse est lu une fois, à l'achat : il y explique sa mesure,
   * d'où la phrase de résumé et la note du moteur. Le tableau de bord est relu
   * chaque semaine, et ces deux-là n'y disent rien que le classement juste en
   * dessous ne montre déjà — le rang est écrit sur la ligne du commerce.
   *
   * La carte étant alors posée à côté de sa jumelle, les deux classements d'un
   * même moteur restent l'un sous l'autre : les mettre côte à côte dans une
   * demi-largeur tronquerait les noms de concurrents.
   */
  compact?: boolean;
  /**
   * L'appel de l'offre, posé par-dessus la mesure floutée.
   *
   * Il vient d'en haut plutôt que d'ici : la carte sait où son flou commence,
   * elle ne sait pas ce qu'il faut acheter pour le lever.
   */
  overlay?: React.ReactNode;
  /**
   * Carte de démonstration, posée sous le voile d'une offre.
   *
   * Le classement affiché est alors entièrement fictif — dix bandes tirées d'une
   * graine stable, sans ligne « vous » —, ce qui donne à la carte la hauteur de
   * sa jumelle ouverte : le voile couvre la même surface des deux côtés. Le flou
   * vient du voile lui-même, pas d'ici : la carte n'ajoute donc pas le sien.
   */
  preview?: boolean;
}) {
  const t = useTranslations("analysisReport.results");
  const vis = visibilityColor(engine.visibility);

  // Tout ce qui constitue la mesure elle-même : c'est cette part qui se floute.
  const body = (
    <div className="space-y-3">
      {compact ? null : preview ? (
        <Obscured strength="md">
          <p className="text-xs text-muted">{engine.summary}</p>
        </Obscured>
      ) : (
        <p className="text-xs text-muted">{engine.summary}</p>
      )}
      {engine.rankings.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-3 ${
            engine.rankings.length > 1 && !compact ? "lg:grid-cols-2" : ""
          }`}
        >
          {engine.rankings.map((r) => (
            <RankingList
              key={r.scope}
              ranking={r}
              locked={locked || preview}
              decoyCount={preview ? PREVIEW_DECOY_COUNT : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <AnimatedCard delay={delay} className="space-y-3">
      {/* En-tête : toujours net — on doit voir QUEL moteur a été interrogé. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {ENGINE_LOGOS[engine.engine] && (
            <Image
              src={ENGINE_LOGOS[engine.engine]}
              alt={engine.engine}
              width={24}
              height={24}
              className="h-5 w-5 shrink-0 rounded"
            />
          )}
          <span className="text-base font-semibold">{engine.engine}</span>
          {/* Sur une carte de démonstration, la note et la mention « mesuré »
              viennent d'un moteur qui n'a pas été interrogé : les afficher
              ferait passer une estimation pour un relevé. */}
          {locked || preview ? (
            <LockedPill />
          ) : (
            <>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={
                  engine.measured
                    ? { background: "rgba(17,180,140,0.18)", color: "#11b48c" }
                    : { background: "rgba(148,163,184,0.15)", color: "#94a3b8" }
                }
                title={engine.measured ? t("measuredHint") : t("estimatedHint")}
              >
                {engine.measured ? t("measured") : t("estimated")}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                style={{ background: `${vis}22`, color: vis }}
              >
                {engine.visibility}
              </span>
            </>
          )}
        </div>
        {/* La note du moteur ne suit pas la carte resserrée : sur le tableau de
            bord, le seul chiffre qui compte est le rang, et il est écrit sur la
            ligne du commerce dans le classement. */}
        {compact ? null : locked || preview ? (
          <Redacted className="shrink-0 text-lg font-bold" label="note masquée" />
        ) : (
          <span className="shrink-0 text-lg font-bold" style={{ color: scoreColor(engine.score) }}>
            {engine.score}
          </span>
        )}
      </div>

      {/* L'appel se pose sur la mesure floutée, jamais sur l'en-tête : le nom du
          moteur et son logo restent lisibles au-dessus de lui. */}
      {overlay ? (
        <div className="relative isolate">
          {body}
          {overlay}
        </div>
      ) : locked ? (
        <Obscured strength="sm">{body}</Obscured>
      ) : (
        body
      )}
    </AnimatedCard>
  );
}
