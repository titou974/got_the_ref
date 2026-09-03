"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { RiCheckLine, RiCornerDownRightLine } from "@remixicon/react";
import {
  approveReviewReplyAction,
  draftReviewRepliesAction,
} from "@/features/dashboard/actions";
import { PlaceStars } from "./PlaceStars";
import { Card, CardTitle } from "../Card";

/**
 * Les réponses aux avis, écrites dans le ton du commerce.
 *
 * Pas de comparaison avant/après ici : il n'y a pas d'avant, il y a un vide.
 * La forme est celle d'un fil — l'avis en clair, la réponse dessous, décalée et
 * marquée du chevron de réponse, comme Google l'affiche. Le client relit
 * l'échange tel qu'il paraîtra sous sa fiche, pas deux textes côte à côte.
 *
 * Rien n'est publié d'ici : l'API Business Profile réclame une validation du
 * compte marchand que nous n'avons pas. On écrit, le client copie, il colle.
 */

export type ReviewReplyRow = {
  id: string;
  reviewId: string;
  reviewerName: string;
  stars: number;
  reviewText: string | null;
  reply: string;
  status: string;
};

export function ReviewReplies({
  rows,
  /** Avis relevés sans réponse du propriétaire : ce qu'il reste à écrire. */
  pending,
}: {
  rows: ReviewReplyRow[];
  pending: number;
}) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const draft = useAction(draftReviewRepliesAction, { onSuccess: () => router.refresh() });
  const approve = useAction(approveReviewReplyAction, { onSuccess: () => router.refresh() });

  async function copy(row: ReviewReplyRow) {
    try {
      await navigator.clipboard.writeText(row.reply);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* presse-papiers indisponible : le texte reste sélectionnable */
    }
  }

  return (
    <Card>
      <CardTitle
        title="Répondre aux avis"
        hint="Une réponse par avis sans réponse, dans le ton relevé sur votre site."
        action={
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => draft.execute({ reviewIds: [] })}
              disabled={draft.isPending || pending === 0}
              className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draft.isPending
                ? "Rédaction…"
                : pending === 0
                  ? "Tous les avis ont une réponse"
                  : `Écrire ${pending} réponse${pending > 1 ? "s" : ""}`}
            </button>
            {draft.result.serverError ? (
              <span className="max-w-[240px] text-right text-[11px] text-danger">
                {draft.result.serverError}
              </span>
            ) : null}
          </div>
        }
      />

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
          Aucune réponse rédigée. Le bouton en écrit une pour chaque avis qui attend.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{row.reviewerName}</span>
                <PlaceStars rating={row.stars} size={13} />
                {row.status === "approved" ? (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                    <RiCheckLine size={11} />
                    Relue
                  </span>
                ) : null}
              </div>

              {row.reviewText ? (
                <p className="mt-1.5 line-clamp-3 text-sm text-muted">« {row.reviewText} »</p>
              ) : (
                <p className="mt-1.5 text-sm italic text-ash">Une note, sans texte.</p>
              )}

              <div className="mt-3 flex gap-2.5 pl-1">
                <RiCornerDownRightLine size={16} className="mt-0.5 shrink-0 text-ash" />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line rounded-2xl bg-mist px-4 py-3 text-sm leading-relaxed">
                    {row.reply}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copy(row)}
                      className="cursor-pointer rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-mist"
                    >
                      {copiedId === row.id ? "Copié" : "Copier"}
                    </button>
                    {row.status === "approved" ? null : (
                      <button
                        type="button"
                        onClick={() => approve.execute({ id: row.id })}
                        disabled={approve.isPending}
                        className="cursor-pointer rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-mist disabled:opacity-50"
                      >
                        Marquer relue
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
