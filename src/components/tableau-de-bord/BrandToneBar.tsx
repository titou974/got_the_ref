"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";

/**
 * Le ton de la marque, posé au-dessus de l'atelier.
 *
 * Il vient du tunnel d'accueil, où il est relevé sur les textes du client :
 * l'article qu'il a désigné, un article trouvé dans le crawl de son site, ou à
 * défaut sa page d'accueil. Il est en tête
 * de l'écran, avant le plan et avant le texte, parce que c'est la contrainte qui
 * s'applique à tout ce qui suit — la relire avant de corriger un paragraphe
 * évite de demander trois fois la même reprise.
 *
 * Les consignes ajoutées depuis la page Articles s'affichent à côté : elles
 * corrigent le ton relevé, elles ne l'effacent pas.
 */
export function BrandToneBar({
  tone,
  voice,
}: {
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
  voice: { instructions: string; banned: string[] } | null;
}) {
  const t = useTranslations("dashboard.article.tone");

  return (
    <section className="rounded-[28px] border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {tone.color ? (
            <span
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-full border border-border"
              style={{ background: tone.color }}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">
              {t("title")}
            </p>
            <p className="mt-0.5 text-sm text-muted">{t("hint")}</p>
          </div>
        </div>
        <Link
          href={ROUTES.dashboardArticles}
          className="shrink-0 cursor-pointer text-sm font-medium text-text underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:decoration-obsidian"
        >
          {t("edit")}
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-mist px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">
            {t("detected")}
          </p>
          {tone.summary ? (
            <p className="mt-1 text-sm leading-relaxed text-text">{tone.summary}</p>
          ) : (
            <p className="mt-1 text-sm italic text-muted">{t("detectedEmpty")}</p>
          )}
          {tone.sampleUrl ? (
            <a
              href={tone.sampleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block cursor-pointer text-xs text-steel underline decoration-pebble underline-offset-2 hover:decoration-obsidian"
            >
              {t("sample")}
            </a>
          ) : null}
        </div>

        <div className="rounded-2xl bg-mist px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">
            {t("instructions")}
          </p>
          {voice?.instructions ? (
            <p className="mt-1 text-sm leading-relaxed text-text">{voice.instructions}</p>
          ) : (
            <p className="mt-1 text-sm italic text-muted">{t("instructionsEmpty")}</p>
          )}
          {voice?.banned.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {voice.banned.map((word) => (
                <span
                  key={word}
                  className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger"
                >
                  {word}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
