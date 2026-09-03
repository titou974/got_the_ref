"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { approveGooglePostAction, planGooglePostsAction } from "@/features/dashboard/actions";
import { photoAt } from "./maps/place-format";
import { Card, CardTitle } from "./Card";

/**
 * Les posts de la fiche Google, préparés à l'avance.
 *
 * Rien n'est publié automatiquement : l'API Business Profile réclame une
 * validation du compte marchand que nous n'avons pas. Le post est donc écrit
 * ici, copié, puis collé dans la fiche. Le calendrier sert à tenir le rythme,
 * pas à promettre une publication qui n'aurait pas lieu.
 */

export type PostRow = {
  id: string;
  title: string;
  body: string;
  cta: string | null;
  keyword: string | null;
  status: string;
  scheduledFor: string | null;
  /** La photo de la fiche qui illustre le post, quand une convenait. */
  imageUrl: string | null;
};

export function GooglePostPlanner({ posts }: { posts: PostRow[] }) {
  const t = useTranslations("dashboard.maps");
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const plan = useAction(planGooglePostsAction, { onSuccess: () => router.refresh() });
  const approve = useAction(approveGooglePostAction, { onSuccess: () => router.refresh() });

  async function copy(post: PostRow) {
    try {
      await navigator.clipboard.writeText(`${post.title}\n\n${post.body}`);
      setCopiedId(post.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* presse-papiers indisponible : le texte reste sélectionnable */
    }
  }

  return (
    <Card>
      <CardTitle
        title={t("postsTitle")}
        hint={t("postsHint")}
        action={
          <button
            type="button"
            onClick={() => plan.execute({ count: 4, everyDays: 7 })}
            disabled={plan.isPending}
            className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
          >
            {plan.isPending ? t("planning") : posts.length ? t("planMore") : t("plan")}
          </button>
        }
      />

      {plan.result.serverError ? (
        <p className="mb-3 text-sm text-danger">{plan.result.serverError}</p>
      ) : null}

      {posts.length === 0 ? (
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  {/* La photo du post, celle qui partira avec lui sur la fiche.
                      Un post Google sans image passe presque inaperçu dans le
                      fil : la montrer ici, c'est montrer ce qui sera publié. */}
                  {post.imageUrl ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={photoAt(post.imageUrl, 160, 160)}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{post.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {post.scheduledFor
                        ? new Date(post.scheduledFor).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })
                        : t("undated")}
                      {post.keyword ? ` · ${post.keyword}` : ""}
                      {post.cta ? ` · ${t(`cta.${post.cta}`)}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
                    post.status === "planned" ? "bg-mist text-steel" : "bg-success/10 text-success"
                  }`}
                >
                  {t(`status.${post.status}`)}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{post.body}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copy(post)}
                  className="cursor-pointer rounded-pill border border-graphite px-4 py-2 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
                >
                  {copiedId === post.id ? t("copied") : t("copy")}
                </button>
                {post.status === "planned" ? (
                  <button
                    type="button"
                    onClick={() => approve.execute({ id: post.id })}
                    disabled={approve.isPending}
                    className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
                  >
                    {t("approve")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
