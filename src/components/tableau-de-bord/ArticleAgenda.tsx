import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";
import { Card, CardTitle } from "./Card";

/**
 * Le calendrier éditorial, réduit aux prochaines sorties.
 *
 * La date est écrite en toutes lettres plutôt qu'en grille mensuelle : quatre
 * articles par mois ne remplissent pas un calendrier, et une grille vide à 90 %
 * donne l'impression qu'il ne se passe rien.
 */

export type AgendaArticle = {
  id: string;
  title: string;
  status: string;
  scheduledFor: Date | null;
};

const STATUS_STYLE: Record<string, string> = {
  planned: "bg-mist text-steel",
  drafted: "bg-obsidian/[0.06] text-ink",
  approved: "bg-success/10 text-success",
  published: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

export async function ArticleAgenda({
  articles,
  limit,
  variant = "upcoming",
}: {
  articles: AgendaArticle[];
  limit?: number;
  /** « published » retitre la carte : même liste, autre moment de la vie. */
  variant?: "upcoming" | "published";
}) {
  const t = await getTranslations("dashboard.agenda");
  const shown = limit ? articles.slice(0, limit) : articles;

  return (
    <Card>
      <CardTitle
        title={t(variant === "published" ? "publishedTitle" : "title")}
        hint={t(variant === "published" ? "publishedHint" : "hint")}
        // Le lien « tout voir » n'a de sens que sur une liste tronquée : sur la
        // page Articles elle-même, il renverrait à la page en cours.
        action={
          limit ? (
            <Link
              href={ROUTES.dashboardArticles}
              className="cursor-pointer text-sm font-medium text-text underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
            >
              {t("all")}
            </Link>
          ) : undefined
        }
      />

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
          {t(variant === "published" ? "publishedEmpty" : "empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((article) => (
            <li key={article.id}>
              <Link
                href={ROUTES.dashboardArticle(article.id)}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 transition-colors duration-200 hover:bg-mist/60"
              >
                <span className="w-14 shrink-0 text-center">
                  <span className="block text-lg font-bold leading-none tabular-nums">
                    {article.scheduledFor
                      ? article.scheduledFor.toLocaleDateString("fr-FR", { day: "numeric" })
                      : "—"}
                  </span>
                  <span className="block text-[11px] uppercase tracking-wide text-steel">
                    {article.scheduledFor
                      ? article.scheduledFor.toLocaleDateString("fr-FR", { month: "short" })
                      : t("undated")}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{article.title}</span>
                </span>
                <span
                  className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
                    STATUS_STYLE[article.status] ?? "bg-mist text-steel"
                  }`}
                >
                  {t(`status.${article.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
