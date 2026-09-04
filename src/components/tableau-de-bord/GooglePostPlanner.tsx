"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { RiImageLine, RiMore2Fill, RiShieldCheckFill } from "@remixicon/react";
import { approveGooglePostAction, planGooglePostsAction } from "@/features/dashboard/actions";
import { photoAt } from "./maps/place-format";
import { Card, CardTitle } from "./Card";

/**
 * Le rythme de posts de la fiche, montré comme Google le montrera.
 *
 * Le post sélectionné paraît dans le cadre exact d'un post Google Business —
 * l'en-tête au nom du commerce, l'image, le texte, le lien « En savoir plus ».
 * À côté, les lundis qui viennent. Le client ne relit pas une liste de textes :
 * il regarde la vignette qu'il s'apprête à publier, et choisit sa date.
 *
 * Rien n'est publié automatiquement : l'API Business Profile réclame une
 * validation du compte marchand que nous n'avons pas. Le post est écrit ici,
 * copié, puis collé dans la fiche. Le calendrier tient le rythme, il ne promet
 * pas une publication qui n'aurait pas lieu.
 */

const GM = {
  "--gm-blue": "#1a73e8",
  "--gm-text": "#202124",
  "--gm-muted": "#70757a",
  "--gm-line": "#e8eaed",
} as React.CSSProperties;

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

export function GooglePostPlanner({
  posts,
  /** Le nom du commerce, celui qui signe le post sur la fiche. */
  businessName,
  rank,
}: {
  posts: PostRow[];
  businessName: string;
  /** Le rang du geste dans l'échelle de la semaine, quand il y figure. */
  rank?: number | null;
}) {
  const t = useTranslations("dashboard.maps");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const plan = useAction(planGooglePostsAction, { onSuccess: () => router.refresh() });
  const approve = useAction(approveGooglePostAction, { onSuccess: () => router.refresh() });

  const selected = posts.find((post) => post.id === selectedId) ?? posts[0] ?? null;

  async function copy(post: PostRow) {
    try {
      await navigator.clipboard.writeText(`${post.title}\n\n${post.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le texte reste sélectionnable */
    }
  }

  return (
    <Card id="posts">
      <CardTitle
        title={rank ? `${rank} — ${t("postsTitle")}` : t("postsTitle")}
        hint="Un lundi sur l'autre, prêt à copier dans Google Business Profile."
        action={
          <button
            type="button"
            onClick={() => plan.execute({ count: 4, everyDays: 7 })}
            disabled={plan.isPending}
            className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 hover:bg-mist disabled:opacity-60"
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {selected ? (
            <div className="w-full shrink-0 sm:w-[300px]">
              <PostPreview post={selected} businessName={businessName} ctaLabel={ctaLabel(t, selected)} />

              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copy(selected)}
                  className="cursor-pointer rounded-pill bg-obsidian px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-ink"
                >
                  {copied ? t("copied") : t("copy")}
                </button>
                {selected.status === "planned" ? (
                  <button
                    type="button"
                    onClick={() => approve.execute({ id: selected.id })}
                    disabled={approve.isPending}
                    className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 hover:bg-mist disabled:opacity-60"
                  >
                    {t("approve")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <ul className="min-w-0 flex-1 space-y-2.5">
            {posts.map((post) => {
              const active = selected?.id === post.id;
              return (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(post.id)}
                    aria-current={active || undefined}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-200 ${
                      active ? "bg-mist" : "hover:bg-mist/60"
                    }`}
                  >
                    <DateChip iso={post.scheduledFor} active={active} />

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${active ? "font-semibold" : "font-medium"}`}
                      >
                        {post.title}
                      </span>
                      {post.keyword ? (
                        <span className="mt-px block truncate text-xs text-muted">
                          {post.keyword}
                        </span>
                      ) : null}
                    </span>

                    <span
                      className={`shrink-0 rounded-pill px-2.5 py-[3px] text-[11px] font-semibold ${
                        post.status === "planned"
                          ? "bg-surface text-muted"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {t(`status.${post.status}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Le post dans le cadre où il paraîtra : la vignette de Google Business. */
function PostPreview({
  post,
  businessName,
  ctaLabel,
}: {
  post: PostRow;
  businessName: string;
  ctaLabel: string;
}) {
  return (
    <article
      style={GM}
      className="overflow-hidden rounded-xl border border-[var(--gm-line)] bg-snow text-[var(--gm-text)] shadow-[0_1px_3px_rgba(60,64,67,0.14)]"
    >
      <header className="flex items-center gap-2.5 p-3">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md border border-[var(--gm-line)]">
          <Image src="/logo.svg" alt="" width={20} height={20} className="h-5 w-5 rounded-[5px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{businessName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--gm-muted)]">
            <RiShieldCheckFill size={12} className="text-[var(--gm-blue)]" />
            {formatPostDate(post.scheduledFor)}
          </p>
        </div>
        <RiMore2Fill size={16} className="shrink-0 text-[var(--gm-muted)]" />
      </header>

      {post.imageUrl ? (
        <div className="relative h-[190px] w-full bg-fog">
          <Image
            src={photoAt(post.imageUrl, 600, 380)}
            alt=""
            fill
            sizes="300px"
            className="object-cover"
            unoptimized
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="grid h-[190px] w-full place-items-center bg-fog">
          <RiImageLine size={24} className="text-ash" />
        </div>
      )}

      <p className="px-3 pb-3.5 pt-3 text-[13px] leading-relaxed">{post.body}</p>

      <p className="border-t border-[var(--gm-line)] py-[11px] text-center text-[13px] font-medium text-[var(--gm-blue)]">
        {ctaLabel}
      </p>
    </article>
  );
}

/** La pastille de date des lundis à venir : « 08 / SEP ». */
function DateChip({ iso, active }: { iso: string | null; active: boolean }) {
  const date = iso ? new Date(iso) : null;

  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-center text-[11px] font-bold uppercase leading-[1.1] tabular-nums ${
        active ? "bg-surface text-muted" : "bg-mist text-ash"
      }`}
    >
      {date ? (
        <span>
          {String(date.getDate()).padStart(2, "0")}
          <br />
          {date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").slice(0, 3)}
        </span>
      ) : (
        <span>—</span>
      )}
    </span>
  );
}

function formatPostDate(iso: string | null): string {
  if (!iso) return "Sans date";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ctaLabel(t: (key: string) => string, post: PostRow): string {
  return post.cta ? t(`cta.${post.cta}`) : t("cta.LEARN_MORE");
}
