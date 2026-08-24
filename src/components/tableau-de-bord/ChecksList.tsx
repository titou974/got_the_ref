import { getTranslations } from "next-intl/server";
import type { DiagnosticSection } from "@/lib/geo/diagnostic";
import { Card, CardTitle, StatusDot } from "./Card";

/**
 * Les contrôles d'une section du diagnostic, tenus à jour par le dernier crawl.
 *
 * Les libellés viennent du rapport d'analyse : un même contrôle porte le même
 * nom dans le rapport public et ici, sinon le client croirait lire deux audits
 * différents.
 */
export async function ChecksList({
  section,
  namespace,
  title,
  hint,
}: {
  section: DiagnosticSection;
  /** « architecture » ou « content », dans les libellés du rapport. */
  namespace: "architecture" | "content";
  title: string;
  hint: string;
}) {
  const t = await getTranslations(`analysisReport.${namespace}.checks`);
  const ts = await getTranslations("dashboard.checks");

  const failing = section.checks.filter((check) => check.status !== "ok").length;

  return (
    <Card>
      <CardTitle
        title={title}
        hint={hint}
        action={
          <span className="rounded-xl bg-mist px-3 py-1 text-sm font-semibold tabular-nums">
            {section.score}
          </span>
        }
      />

      <p className="mb-4 text-sm text-muted">
        {failing === 0
          ? ts("allGood")
          : ts("failing", { count: failing, total: section.checks.length })}
      </p>

      <ul className="divide-y divide-border">
        {section.checks.map((check) => (
          <li key={check.key} className="flex items-center justify-between gap-3 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <StatusDot status={check.status} />
              <span className="truncate text-sm">{t(check.key)}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">
              {check.value ?? ts(`status.${check.status}`)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
