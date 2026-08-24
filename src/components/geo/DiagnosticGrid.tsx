"use client";

import { useTranslations } from "next-intl";
import type { DiagnosticCheck, DiagnosticSection, DiagnosticStatus } from "@/lib/geo/diagnostic";
import { Veil, useLocked } from "@/components/dashboard/LockedContent";

/**
 * La grille de contrôles du diagnostic, telle qu'elle apparaît dans le rapport
 * d'analyse.
 *
 * Elle vit ici plutôt que dans les onglets du rapport parce que le tableau de
 * bord montre exactement les mêmes contrôles : deux copies auraient divergé au
 * premier ajustement, et le client aurait vu deux verdicts pour un seul crawl.
 *
 * Hors rapport, `useLocked` renvoie false : rien n'est voilé, et le composant se
 * comporte comme un tableau ordinaire.
 */

const STATUS_COLOR: Record<DiagnosticStatus, string> = {
  ok: "#11b48c",
  warn: "#f59e0b",
  ko: "#e5484d",
  unknown: "#94a3b8",
};

const SCORE_KEYS = new Set(["editorialQuality", "citability", "mapsCoherence"]);

export function StatusPill({ status }: { status: DiagnosticStatus }) {
  const t = useTranslations("analysisReport.status");
  const locked = useLocked();
  // Sur l'aperçu gratuit, aucun contrôle ne s'affiche en vert : le statut reste
  // exact, mais rien n'y est présenté comme acquis tant que l'audit complet n'a
  // pas tourné. Le « ok » passe donc en neutre, pas en validation.
  const color = locked && status === "ok" ? "#71717a" : STATUS_COLOR[status];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}22`, color }}
    >
      {t(status)}
    </span>
  );
}

export function CheckRow({
  check,
  labelNs,
  veiled = false,
}: {
  check: DiagnosticCheck;
  labelNs: "architecture" | "content";
  /** Contrôle issu de l'audit payant : on montre ce qui est examiné, pas le résultat. */
  veiled?: boolean;
}) {
  const t = useTranslations("analysisReport");
  const label = t(`${labelNs}.checks.${check.key}`);

  let detail: string | null = null;
  if (check.value != null) {
    if (check.key === "schema") detail = check.value;
    else if (check.key === "wordCount") detail = t("content.units.words", { value: check.value });
    else if (check.key === "mapsReviews") detail = t("content.units.reviews", { value: check.value });
    else if (SCORE_KEYS.has(check.key)) detail = t("content.units.score", { value: check.value });
    else if (check.key === "h1") detail = t("architecture.h1Count", { value: check.value });
    else if (check.key === "llmsTxt") detail = t("architecture.llmsTxtMisconfigured");
    else if (check.key === "aiCrawlers" && check.status !== "ok")
      detail = t("architecture.blockedCrawlers", { value: check.value });
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-fog py-2.5 last:border-0">
      <div className="min-w-0">
        {/* Le libellé du contrôle est constant : il ne révèle aucun résultat. */}
        <p className="truncate text-sm text-text">{label}</p>
        {detail &&
          (veiled ? (
            <Veil>
              <span className="text-xs text-muted">{detail}</span>
            </Veil>
          ) : (
            <p className="truncate text-xs text-muted">{detail}</p>
          ))}
      </div>
      {veiled ? (
        <Veil>
          <StatusPill status={check.status} />
        </Veil>
      ) : (
        <StatusPill status={check.status} />
      )}
    </li>
  );
}

export function DiagnosticGrid({
  section,
  labelNs,
  veiled = false,
}: {
  section: DiagnosticSection;
  labelNs: "architecture" | "content";
  veiled?: boolean;
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {section.checks.map((c) => (
        <CheckRow key={c.key} check={c} labelNs={labelNs} veiled={veiled} />
      ))}
    </ul>
  );
}
