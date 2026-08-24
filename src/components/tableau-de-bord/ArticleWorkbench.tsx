"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  approveArticleAction,
  publishArticleAction,
  rejectArticleAction,
  updateArticleAction,
  writeArticleAction,
} from "@/features/dashboard/actions";
import { Card, CardTitle } from "./Card";

/**
 * L'atelier d'un article : le plan et les consignes à gauche, le texte à droite.
 *
 * Le corps est édité en Markdown brut. Un éditeur riche masquerait la structure
 * (titres, listes) qui est justement ce que les IA lisent, et c'est cette
 * structure que le client doit pouvoir corriger.
 *
 * Quatre gestes : réécrire (avec une consigne), enregistrer, valider, publier.
 * Publier n'apparaît qu'une fois l'article validé et le site rattaché en
 * écriture, faute de quoi le bouton mènerait à une erreur.
 */

export type WorkbenchArticle = {
  id: string;
  title: string;
  keyword: string | null;
  outline: string[];
  body: string;
  excerpt: string | null;
  status: string;
  revisions: number;
  scheduledFor: string | null;
  externalUrl: string | null;
};

export function ArticleWorkbench({
  article,
  canPublish,
}: {
  article: WorkbenchArticle;
  canPublish: boolean;
}) {
  const t = useTranslations("dashboard.article");
  const router = useRouter();

  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body);
  const [instruction, setInstruction] = useState("");

  const refresh = () => router.refresh();
  const write = useAction(writeArticleAction, { onSuccess: refresh });
  const save = useAction(updateArticleAction, { onSuccess: refresh });
  const approve = useAction(approveArticleAction, { onSuccess: refresh });
  const publish = useAction(publishArticleAction, { onSuccess: refresh });
  const reject = useAction(rejectArticleAction, { onSuccess: refresh });

  const busy =
    write.isPending || save.isPending || approve.isPending || publish.isPending || reject.isPending;

  const error =
    write.result.serverError ??
    save.result.serverError ??
    approve.result.serverError ??
    publish.result.serverError ??
    reject.result.serverError;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardTitle title={t("brief")} />
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-steel">
                {t("keyword")}
              </dt>
              <dd className="mt-1 text-sm">{article.keyword ?? t("noKeyword")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-steel">
                {t("outline")}
              </dt>
              <dd className="mt-1">
                {article.outline.length ? (
                  <ol className="space-y-1.5">
                    {article.outline.map((heading, index) => (
                      <li key={heading} className="flex gap-2 text-sm">
                        <span className="text-ash tabular-nums">{index + 1}.</span>
                        <span>{heading}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">{t("noOutline")}</p>
                )}
              </dd>
            </div>
            {article.excerpt ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-steel">
                  {t("angle")}
                </dt>
                <dd className="mt-1 text-sm text-muted">{article.excerpt}</dd>
              </div>
            ) : null}
            {article.revisions > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-steel">
                  {t("revisions")}
                </dt>
                <dd className="mt-1 text-sm">{article.revisions}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardTitle title={t("rewrite")} hint={t("rewriteHint")} />
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={3}
            placeholder={t("instructionPlaceholder")}
            className="w-full rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              write.execute({ id: article.id, instruction: instruction.trim() || undefined })
            }
            className="mt-3 w-full cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
          >
            {write.isPending ? t("writing") : article.body ? t("rewriteCta") : t("writeCta")}
          </button>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
            {t(`status.${article.status}`)}
          </span>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save.execute({ id: article.id, title, body })}
              className="cursor-pointer rounded-pill border border-graphite px-4 py-2 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60"
            >
              {save.isPending ? t("saving") : t("save")}
            </button>

            {article.status === "drafted" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => approve.execute({ id: article.id })}
                className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
              >
                {t("approve")}
              </button>
            ) : null}

            {article.status === "approved" && canPublish ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => publish.execute({ id: article.id })}
                className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
              >
                {publish.isPending ? t("publishing") : t("publish")}
              </button>
            ) : null}

            {article.status !== "published" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => reject.execute({ id: article.id })}
                className="cursor-pointer text-sm text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-danger"
              >
                {t("drop")}
              </button>
            ) : null}
          </div>
        </div>

        {article.status === "approved" && !canPublish ? (
          <p className="mb-3 rounded-2xl bg-mist px-4 py-3 text-sm text-muted">
            {t("noPublishLink")}
          </p>
        ) : null}

        {article.externalUrl ? (
          <p className="mb-3 text-sm">
            <a
              href={article.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer font-medium underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
            >
              {t("seeOnline")}
            </a>
          </p>
        ) : null}

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-[14px] border border-border bg-surface px-3 py-2.5 text-lg font-semibold"
        />

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={26}
          placeholder={t("bodyPlaceholder")}
          className="mt-3 w-full rounded-[14px] border border-border bg-surface px-3 py-3 font-mono text-[13px] leading-relaxed"
        />
      </Card>
    </div>
  );
}
