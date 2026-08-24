import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";
import { Card, CardTitle } from "./Card";

/**
 * Le calendrier éditorial du mois, posé sur une grille de jours.
 *
 * C'est la vue du rapport d'analyse, avec une différence qui change tout : les
 * cases ne portent plus une projection de titres possibles mais les articles
 * réellement programmés, et chaque case mène à l'atelier de son article.
 *
 * La grille se calcule en UTC. Les constructeurs `Date` locaux donneraient un
 * jour de la semaine différent selon le fuseau du serveur et celui du
 * navigateur, et le premier du mois glisserait d'une colonne à la relecture.
 */

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export type MonthArticle = {
  id: string;
  title: string;
  status: string;
  scheduledFor: Date | null;
};

const STATUS_TINT: Record<string, string> = {
  planned: "border-fog bg-mist",
  drafted: "border-pebble/70 bg-mist",
  approved: "border-success/40 bg-success/[0.07]",
  published: "border-success/40 bg-success/[0.07]",
  rejected: "border-danger/30 bg-danger/[0.05]",
};

/** Décalage du 1ᵉʳ du mois dans une grille commençant le lundi (0 = lundi). */
function mondayOffset(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

/** Nombre de jours du mois (le jour 0 du mois suivant = dernier jour). */
function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Le mois à afficher : celui de la première publication programmée, sinon le
 * mois en cours. Ouvrir sur un mois vide alors que le planning commence trois
 * semaines plus tard donnerait l'impression que rien n'est prévu.
 */
function pickMonth(articles: MonthArticle[]): { year: number; month: number } {
  const dated = articles
    .map((a) => a.scheduledFor)
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const ref = dated[0] ?? new Date();
  return { year: ref.getUTCFullYear(), month: ref.getUTCMonth() };
}

export async function ArticleMonth({ articles }: { articles: MonthArticle[] }) {
  const t = await getTranslations("dashboard.calendar");
  const { year, month } = pickMonth(articles);

  const offset = mondayOffset(year, month);
  const daysInMonth = daysInMonthUtc(year, month);

  // Un jour peut porter plusieurs articles : la case les empile.
  const byDay = new Map<number, MonthArticle[]>();
  for (const article of articles) {
    const date = article.scheduledFor;
    if (!date || Number.isNaN(date.getTime())) continue;
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month) continue;
    const day = date.getUTCDate();
    byDay.set(day, [...(byDay.get(day) ?? []), article]);
  }

  const placed = [...byDay.values()].reduce((total, list) => total + list.length, 0);
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1,
  );

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={t("hint")}
        action={
          <span className="rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
            {t("count", { count: placed })}
          </span>
        }
      />

      <p className="mb-3 text-sm font-semibold capitalize">
        {MONTHS[month]} {year}
      </p>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-steel"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`empty-${i}`} />;
          const dayArticles = byDay.get(day) ?? [];
          return (
            <div
              key={day}
              className={`min-h-[68px] rounded-xl border p-1.5 ${
                dayArticles.length ? "border-pebble/70 bg-mist" : "border-fog bg-surface"
              }`}
            >
              <span className="block text-[11px] font-semibold tabular-nums text-steel">{day}</span>
              <span className="mt-1 flex flex-col gap-1">
                {dayArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={ROUTES.dashboardArticle(article.id)}
                    className={`block cursor-pointer overflow-hidden rounded-lg border px-1.5 py-1 text-[10px] leading-snug text-text transition-colors duration-200 hover:bg-snow ${
                      STATUS_TINT[article.status] ?? "border-fog bg-surface"
                    }`}
                  >
                    <span className="line-clamp-2">{article.title}</span>
                  </Link>
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {placed === 0 ? <p className="mt-4 text-sm text-muted">{t("empty")}</p> : null}
    </Card>
  );
}
