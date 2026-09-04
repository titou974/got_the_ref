"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { RiCheckLine, RiCornerDownRightLine, RiMore2Fill } from "@remixicon/react";
import {
  approveReviewReplyAction,
  draftReviewRepliesAction,
} from "@/features/dashboard/actions";
import type { GooglePlace, PlaceReview } from "@/lib/apify/place-types";
import { PlaceStars } from "./PlaceStars";
import { avatarAt } from "./place-format";
import { Card, CardTitle } from "../Card";

/**
 * Les avis qui attendent, un à la fois.
 *
 * L'écran précédent empilait les sept avis et leurs sept réponses : le client
 * relisait une colonne, et ne savait plus lequel il avait traité. Ici il n'y en
 * a qu'un — celui du dessus de la pile — rendu exactement comme Google le
 * montre sous la fiche, avec la réponse dessous, décalée et marquée du chevron.
 * Le client relit l'échange tel qu'il paraîtra, copie, passe au suivant.
 *
 * Rien n'est publié d'ici : l'API Business Profile réclame une validation du
 * compte marchand que nous n'avons pas. On écrit, le client copie, il colle.
 */

const GM = {
  "--gm-blue": "#1a73e8",
  "--gm-star": "#e7711b",
  "--gm-text": "#202124",
  "--gm-muted": "#70757a",
  "--gm-line": "#e8eaed",
} as React.CSSProperties;

export type ReviewReplyRow = {
  id: string;
  reviewId: string;
  reviewerName: string;
  stars: number;
  reviewText: string | null;
  reply: string;
  status: string;
};

/** Un avis à traiter : ce que Google en montre, et ce qu'on a écrit dessous. */
type Entry = {
  reviewId: string;
  name: string;
  photo: string | null;
  stars: number;
  text: string | null;
  relative: string | null;
  reviewerCount: number | null;
  imagesCount: number;
  context: { label: string; value: string }[];
  reply: ReviewReplyRow | null;
};

export function ReviewFocus({
  place,
  rows,
  /** Le rang du geste dans l'échelle de la semaine, quand il y figure. */
  rank,
}: {
  place: GooglePlace;
  rows: ReviewReplyRow[];
  rank: number | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const draft = useAction(draftReviewRepliesAction, { onSuccess: () => router.refresh() });
  const approve = useAction(approveReviewReplyAction, { onSuccess: () => router.refresh() });

  const entries = useMemo(() => buildEntries(place.reviews, rows), [place.reviews, rows]);

  const drafted = entries.filter((entry) => entry.reply !== null);
  const unanswered = entries.filter((entry) => entry.reply === null).length;

  const current = entries[Math.min(index, Math.max(entries.length - 1, 0))] ?? null;

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* presse-papiers indisponible : le texte reste sélectionnable */
    }
  }

  function goNext() {
    setExpanded(false);
    setIndex((value) => (entries.length === 0 ? 0 : (value + 1) % entries.length));
  }

  const title = entries.length === 0 ? "Répondre aux avis" : `Répondre à ${entries.length} avis`;

  return (
    <Card id="avis">
      <CardTitle
        title={rank ? `${rank} — ${title}` : title}
        hint={
          drafted.length > 0
            ? "Relisez, copiez, collez sous l'avis dans Google Business Profile."
            : "Une réponse par avis sans réponse, dans le ton relevé sur votre site."
        }
        action={
          <div className="flex flex-col items-end gap-1">
            {unanswered > 0 ? (
              <button
                type="button"
                onClick={() => draft.execute({ reviewIds: [] })}
                disabled={draft.isPending}
                className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {draft.isPending ? "Rédaction…" : `Écrire ${unanswered} réponse${unanswered > 1 ? "s" : ""}`}
              </button>
            ) : drafted.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  copyText(
                    "all",
                    drafted.map((entry) => entry.reply?.reply ?? "").join("\n\n———\n\n"),
                  )
                }
                className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 hover:bg-mist"
              >
                {copied === "all" ? "Copié" : "Tout copier"}
              </button>
            ) : null}
            {draft.result.serverError ? (
              <span className="max-w-[240px] text-right text-[11px] text-danger">
                {draft.result.serverError}
              </span>
            ) : null}
          </div>
        }
      />

      {current === null ? (
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
          Tous les avis relevés portent déjà une réponse. Le prochain relevé rapportera les suivants.
        </p>
      ) : (
        <>
          <article
            style={GM}
            className="rounded-2xl border border-[var(--gm-line)] px-5 py-[18px] text-[var(--gm-text)]"
          >
            <header className="flex items-start gap-3">
              <Avatar name={current.name} photo={current.photo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{current.name}</p>
                <p className="mt-px text-xs text-[var(--gm-muted)]">
                  {[
                    current.reviewerCount ? `${current.reviewerCount} avis` : null,
                    current.imagesCount > 0 ? `${current.imagesCount} photos` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Client"}
                </p>
              </div>
              <RiMore2Fill size={18} className="shrink-0 text-[var(--gm-muted)]" />
            </header>

            <div className="mt-2.5 flex items-center gap-2">
              <PlaceStars rating={current.stars} size={15} />
              {current.relative ? (
                <span className="text-[13px] text-[var(--gm-muted)]">{current.relative}</span>
              ) : null}
            </div>

            {current.text ? (
              <p className={`mt-2.5 text-sm leading-relaxed ${expanded ? "" : "line-clamp-4"}`}>
                {current.text}{" "}
                {!expanded && current.text.length > 220 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="cursor-pointer font-medium text-[var(--gm-blue)]"
                  >
                    Plus
                  </button>
                ) : null}
              </p>
            ) : (
              <p className="mt-2.5 text-sm italic text-[var(--gm-muted)]">Une note, sans texte.</p>
            )}

            {current.context.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--gm-muted)]">
                {current.context.map((item) => `${item.label} : ${item.value}`).join(" · ")}
              </p>
            ) : null}

            <div className="mt-3.5 flex gap-3 border-t border-[var(--gm-line)] pt-3.5">
              <RiCornerDownRightLine size={16} className="mt-1 shrink-0 text-ash" />
              <div className="min-w-0 flex-1">
                {current.reply ? (
                  <>
                    <p className="whitespace-pre-line rounded-2xl bg-mist px-4 py-3 text-sm leading-relaxed">
                      {current.reply.reply}
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(current.reviewId, current.reply!.reply)}
                        className="cursor-pointer rounded-pill bg-obsidian px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-ink"
                      >
                        {copied === current.reviewId ? "Copié" : "Copier"}
                      </button>
                      <button
                        type="button"
                        onClick={() => draft.execute({ reviewIds: [current.reviewId] })}
                        disabled={draft.isPending || current.reply.status === "approved"}
                        className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {draft.isPending ? "Rédaction…" : "Réécrire"}
                      </button>
                      {current.reply.status === "approved" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-3.5 py-1.5 text-[13px] font-medium text-success">
                          <RiCheckLine size={13} />
                          Relue
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => approve.execute({ id: current.reply!.id })}
                          disabled={approve.isPending}
                          className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 hover:bg-mist disabled:opacity-50"
                        >
                          Marquer relue
                        </button>
                      )}
                    </div>
                  </>
                ) : draft.isPending ? (
                  <span className="block h-[72px] w-full rounded-2xl shimmer" />
                ) : (
                  <p className="rounded-2xl border border-dashed border-pebble px-4 py-3 text-sm text-muted">
                    Pas encore de réponse écrite pour cet avis.
                  </p>
                )}
              </div>
            </div>
          </article>

          {entries.length > 1 ? (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                Avis {Math.min(index, entries.length - 1) + 1} sur {entries.length} ·{" "}
                {nextNames(entries, index)}
              </p>
              <button
                type="button"
                onClick={goNext}
                className="cursor-pointer text-[13px] font-semibold underline-offset-4 hover:underline"
              >
                Avis suivant
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

/**
 * Les avis à traiter, dans l'ordre où on veut les traiter.
 *
 * Ceux qui portent déjà une réponse rédigée passent devant : il n'y a plus qu'à
 * les copier, c'est le geste le plus court. Les réponses déjà marquées relues
 * ferment la marche — elles sont sur la fiche, ou tout comme.
 */
function buildEntries(reviews: PlaceReview[], rows: ReviewReplyRow[]): Entry[] {
  const byReview = new Map(rows.map((row) => [row.reviewId, row]));

  const fromPlace = reviews
    .filter((review) => review.ownerResponse === null)
    .map<Entry>((review) => ({
      reviewId: review.id,
      name: review.name,
      photo: review.photo,
      stars: review.stars,
      text: review.text,
      relative: review.relative,
      reviewerCount: review.reviewerCount,
      imagesCount: review.images.length,
      context: review.context.slice(0, 2),
      reply: byReview.get(review.id) ?? null,
    }));

  // Une réponse écrite sur un relevé plus ancien : l'avis n'est plus dans la
  // fiche relevée, mais le texte, lui, attend toujours d'être copié.
  const seen = new Set(fromPlace.map((entry) => entry.reviewId));
  const orphans = rows
    .filter((row) => !seen.has(row.reviewId))
    .map<Entry>((row) => ({
      reviewId: row.reviewId,
      name: row.reviewerName,
      photo: null,
      stars: row.stars,
      text: row.reviewText,
      relative: null,
      reviewerCount: null,
      imagesCount: 0,
      context: [],
      reply: row,
    }));

  return [...fromPlace, ...orphans].sort((a, b) => weight(a) - weight(b));
}

function weight(entry: Entry): number {
  if (entry.reply === null) return 1;
  return entry.reply.status === "approved" ? 2 : 0;
}

/** « Thomas Lenoir, Claire Bonnet, +4 » — qui attend derrière celui-ci. */
function nextNames(entries: Entry[], index: number): string {
  const rest = entries.filter((_, position) => position !== index);
  const shown = rest.slice(0, 2).map((entry) => entry.name);
  const hidden = rest.length - shown.length;
  return [...shown, hidden > 0 ? `+${hidden}` : null].filter(Boolean).join(", ");
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return (
      <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full">
        <Image
          src={avatarAt(photo, 80)}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          unoptimized
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-obsidian text-[17px] font-medium text-white">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
