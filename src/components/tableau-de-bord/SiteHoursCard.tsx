"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { RiRefreshLine } from "@remixicon/react";
import { readSiteHoursAction } from "@/features/dashboard/actions";
import type { SiteHoursCheck } from "@/lib/apify/place-types";
import { Card, CardTitle, StatusDot } from "./Card";

/**
 * Les horaires de la page d'accueil, confrontés à ceux de la fiche Google.
 *
 * C'est l'incohérence locale la plus répandue, et la moins visible du dedans :
 * le site garde les horaires d'été trois ans pendant que la fiche est tenue à
 * jour. Google croise les deux sources, et quand elles se contredisent il n'en
 * croit plus aucune franchement.
 *
 * La carte montre le désaccord jour par jour, dans les deux écritures — celle
 * du site à gauche, celle de la fiche à droite — parce que c'est le site qu'il
 * faudra corriger, et qu'il faut pouvoir y retrouver la ligne exacte.
 */
export function SiteHoursCard({
  check,
  /** Vrai quand la fiche Google a été relevée : sans elle, rien à comparer. */
  hasListing,
}: {
  check: SiteHoursCheck | null;
  hasListing: boolean;
}) {
  const router = useRouter();
  const read = useAction(readSiteHoursAction, { onSuccess: () => router.refresh() });

  const status = !check
    ? "unknown"
    : !check.found
      ? "ko"
      : check.conflicts.length > 0
        ? "warn"
        : "ok";

  return (
    <Card>
      <CardTitle
        title="Vos horaires, sur le site et sur la fiche"
        hint={
          check?.summary ??
          "Google croise les horaires de votre site avec ceux de votre fiche. Deux versions différentes les affaiblissent toutes les deux."
        }
        action={
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => read.execute({})}
              disabled={read.isPending}
              className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-mist disabled:opacity-50"
            >
              <RiRefreshLine size={14} className={read.isPending ? "animate-spin" : ""} />
              {read.isPending ? "Lecture…" : check ? "Relire la page" : "Lire ma page d'accueil"}
            </button>
            {read.result.serverError ? (
              <span className="max-w-[240px] text-right text-[11px] text-danger">
                {read.result.serverError}
              </span>
            ) : null}
          </div>
        }
      />

      {!check ? (
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
          Nous n'avons pas encore lu les horaires de votre page d'accueil.
        </p>
      ) : !check.found ? (
        <div className="rounded-2xl bg-mist px-4 py-6 text-center">
          <p className="text-sm font-medium">Aucun horaire sur votre page d'accueil</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Ajoutez-les en toutes lettres dans votre pied de page, avec les mêmes créneaux que votre
            fiche. C'est ce que Google recoupe pour vérifier que votre établissement est bien celui
            qu'il croit.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2.5 border-b border-border pb-4">
            <StatusDot status={status} />
            <span className="text-sm">
              {check.conflicts.length === 0
                ? "Le site et la fiche disent la même chose."
                : `${check.conflicts.length} jour${check.conflicts.length > 1 ? "s" : ""} en désaccord.`}
            </span>
            {check.location ? (
              <span className="ml-auto shrink-0 text-xs text-muted">
                Lus dans : {check.location}
              </span>
            ) : null}
          </div>

          {check.conflicts.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-steel">
                  <th className="pb-2 font-medium">Jour</th>
                  <th className="pb-2 font-medium">Sur votre site</th>
                  <th className="pb-2 font-medium">Sur votre fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {check.conflicts.map((conflict) => (
                  <tr key={conflict.day}>
                    <td className="py-2.5 capitalize">{conflict.day}</td>
                    <td className="py-2.5 tabular-nums text-danger">{conflict.site}</td>
                    <td className="py-2.5 tabular-nums">{conflict.listing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {check.days.map((day) => (
                <li key={day.day} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="capitalize text-muted">{day.day}</span>
                  <span className="tabular-nums">{day.hours}</span>
                </li>
              ))}
            </ul>
          )}

          {!hasListing ? (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
              Relevez votre fiche Google Maps depuis l'onglet Google Maps pour comparer les deux.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
