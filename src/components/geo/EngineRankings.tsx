"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { EngineRanking, EngineScore } from "@/lib/geo/types";
import { decoyRanking } from "@/lib/geo/decoy-ranking";
import { scoreColor, visibilityColor } from "@/lib/score";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { LockedPill, Obscured } from "@/components/dashboard/LockedContent";

/**
 * Le classement d'un commerce dans chaque moteur, carte par carte.
 *
 * C'est le bloc central du rapport, et c'est aussi celui que le client vient
 * revoir chaque semaine dans son tableau de bord : les deux écrans partagent
 * donc le même composant. Verrouillé, la carte garde son en-tête net — on doit
 * voir QUEL moteur a répondu — et ne floute que la mesure.
 */

/** Logos des moteurs IA (chemins dans /public), indexés par nom de moteur. */
const ENGINE_LOGOS: Record<string, string> = {
  ChatGPT: "/chatgpt.png",
  Gemini: "/gemini.webp",
};

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
}: {
  ranking: EngineRanking;
  locked?: boolean;
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
          // Même « non classé » est une information : on n'en dit rien.
          <span className="shrink-0 rounded-lg bg-fog px-2 py-0.5 text-sm font-bold text-ash">
            #?
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
        <DecoyBands seedKey={`${ranking.label}|${ranking.scope}`} />
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
function DecoyBands({ seedKey }: { seedKey: string }) {
  const entries = decoyRanking(seedKey);
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
}: {
  engine: EngineScore;
  delay: number;
  /** Verrouillé : le moteur et son nom restent lisibles, la mesure est floutée. */
  locked?: boolean;
}) {
  const t = useTranslations("analysisReport.results");
  const vis = visibilityColor(engine.visibility);

  // Tout ce qui constitue la mesure elle-même : c'est cette part qui se floute.
  const body = (
    <div className="space-y-3">
      <p className="text-xs text-muted">{engine.summary}</p>
      {engine.rankings.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-3 ${engine.rankings.length > 1 ? "lg:grid-cols-2" : ""}`}
        >
          {engine.rankings.map((r) => (
            <RankingList key={r.scope} ranking={r} locked={locked} />
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
          {locked ? (
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
        {locked ? (
          <span className="shrink-0 text-lg font-bold text-pebble" aria-hidden>
            ••
          </span>
        ) : (
          <span className="shrink-0 text-lg font-bold" style={{ color: scoreColor(engine.score) }}>
            {engine.score}
          </span>
        )}
      </div>

      {locked ? <Obscured strength="sm">{body}</Obscured> : body}
    </AnimatedCard>
  );
}
