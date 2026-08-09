import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import { buildFreeReport, pickVariant } from "@/lib/geo/free-report";
import { ROUTES } from "@/constants/routes";

/**
 * Le constat livré d'office sur une analyse gratuite : ce qui tient, ce qui
 * manque, et surtout ce qui n'a pas encore été mesuré — la part qui porte le
 * gain de classement sur les IA et Google. La formulation change d'un rapport à
 * l'autre (graine déterministe), le fond reste factuel.
 */
export async function FreeReportCard({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = await getTranslations("freeReport");
  const ta = await getTranslations("analysisReport.architecture.checks");
  const facts = buildFreeReport(result, diagnostic);

  const pool = (key: string) => t.raw(key) as string[];
  const variant = <T,>(items: readonly T[], offset: number) =>
    pickVariant(items, facts.seed, offset);

  const headline = variant(pool("headlines"), 1).replace("{domain}", result.domain);
  const intro = variant(pool("intros"), 2).replace("{score}", String(facts.score));
  const closing = variant(pool("closings"), 3);
  const cta = variant(pool("ctas"), 4);

  return (
    <section className="rounded-[36px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
      <h2 className="mt-2 text-balance text-xl font-bold sm:text-2xl">{headline}</h2>
      <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted">{intro}</p>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        {facts.strengths.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-steel">
              {t("strengthsTitle")}
            </h3>
            <ul className="mt-3 space-y-2">
              {facts.strengths.map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm text-text">
                  <Mark ok />
                  <span>{ta(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {facts.gaps.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-steel">
              {t("gapsTitle")}
            </h3>
            <ul className="mt-3 space-y-2">
              {facts.gaps.map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm text-text">
                  <Mark />
                  <span>{ta(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Le cœur de l'argument : ce qu'on n'a pas encore mesuré. */}
      <div className="mt-7 rounded-3xl bg-mist p-5 sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-steel">
          {t("unmeasuredTitle")}
        </h3>
        <ul className="mt-3 space-y-2.5">
          {facts.unmeasured.map((angle, i) => (
            <li key={angle} className="flex items-start gap-3 text-sm leading-relaxed text-text">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pebble"
              />
              <span>{variant(pool(`unmeasured.${angle}`), 10 + i)}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-text">{closing}</p>

      <Link
        href={ROUTES.pricing}
        className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
      >
        {cta}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </section>
  );
}

/** Puce de constat : coche pour un acquis, croix pour un manque. */
function Mark({ ok = false }: { ok?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`mt-0.5 shrink-0 ${ok ? "text-text" : "text-ash"}`}
    >
      {ok ? (
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      )}
    </svg>
  );
}
