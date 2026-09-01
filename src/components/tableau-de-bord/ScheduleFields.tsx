"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { scheduleArticleAction } from "@/features/dashboard/actions";
import {
  PUBLISH_DEFAULT_HOUR,
  PUBLISH_HOURS,
  PUBLISH_HOUR_IS_CHOSEN,
  formatPublishTime,
  preferredPassOnDay,
  splitPublishInstant,
  toPublishInstant,
} from "@/constants/publishing";

/**
 * Choisir le jour et l'heure d'une publication.
 *
 * Le même bloc sert au quai de départ et à l'atelier d'article : planifier est
 * un seul geste dans le produit, il doit avoir une seule forme. Il s'ouvre sous
 * le bouton qui l'appelle plutôt que dans une fenêtre — la question tient en
 * deux champs, et une modale pour deux champs fait perdre de vue l'article
 * qu'on est en train de dater.
 *
 * On ne fait choisir que ce qui se choisit. La file ne repasse qu'une fois par
 * jour — l'hébergement n'en offre pas plus — donc l'heure du départ n'est pas
 * une décision du client : c'est une propriété du système. Le formulaire
 * l'annonce au lieu de la demander. Un sélecteur d'heure aurait été un décor :
 * quelle que soit l'heure cochée, l'article serait parti au même passage, et le
 * client aurait cru maîtriser quelque chose qui ne dépendait pas de lui.
 *
 * Le sélecteur reste écrit, derrière `PUBLISH_HOUR_IS_CHOSEN` : le jour où la
 * file repassera toutes les heures, il réapparaîtra sans qu'on y revienne.
 *
 * Le jour passe par le champ de date du navigateur : il est déjà traduit,
 * navigable au clavier et ouvre le calendrier natif du téléphone. Le remplacer
 * par un calendrier maison coûterait trois cents lignes pour reprendre ce qu'il
 * fait mieux.
 */
export function ScheduleFields({
  articleId,
  current,
  onDone,
}: {
  articleId: string;
  /** La date déjà posée, en ISO. Le formulaire s'ouvre dessus. */
  current: string | null;
  onDone?: () => void;
}) {
  const t = useTranslations("dashboard.dock");
  const router = useRouter();

  const start = current ? splitPublishInstant(current) : null;
  const [day, setDay] = useState(start?.day ?? todayInParis());
  const [hour, setHour] = useState(start?.hour ?? PUBLISH_DEFAULT_HOUR);

  const schedule = useAction(scheduleArticleAction, {
    onSuccess: () => {
      router.refresh();
      onDone?.();
    },
  });

  // L'heure déjà posée peut ne pas figurer dans la liste — une date venue du
  // planning automatique, ou d'une cadence antérieure. On l'y ajoute plutôt que
  // de la remplacer en douce : le client verrait son heure changer seule.
  //
  // Calculé sans condition, et c'est voulu : la liste ne coûte rien, tandis
  // qu'un `useState` ou un `useMemo` posé derrière `PUBLISH_HOUR_IS_CHOSEN`
  // changerait le nombre de crochets appelés selon la cadence — ce que React
  // interdit. Le sélecteur, lui, n'est rendu que si l'heure se choisit.
  const hours = PUBLISH_HOURS.includes(hour as (typeof PUBLISH_HOURS)[number])
    ? [...PUBLISH_HOURS]
    : [...PUBLISH_HOURS, hour].sort((a, b) => a - b);

  /** Ce qui partira réellement : le passage que vaut le jour choisi. */
  const instant = PUBLISH_HOUR_IS_CHOSEN
    ? toPublishInstant(day, hour)
    : preferredPassOnDay(day);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        schedule.execute({ id: articleId, scheduledFor: instant });
      }}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-mist/50 p-3.5"
    >
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-steel">
          {t("scheduleDay")}
        </span>
        <input
          type="date"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          required
          className="h-10 cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        />
      </label>

      {PUBLISH_HOUR_IS_CHOSEN ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel">
            {t("scheduleHour")}
          </span>
          <select
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
            className="h-10 cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {hours.map((value) => (
              <option key={value} value={value}>
                {`${String(value).padStart(2, "0")}:00`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={schedule.isPending}
        className="h-10 cursor-pointer rounded-pill bg-obsidian px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
      >
        {schedule.isPending ? t("scheduleSaving") : t("scheduleConfirm")}
      </button>

      {onDone ? (
        <button
          type="button"
          onClick={onDone}
          className="h-10 cursor-pointer px-1 text-sm text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text"
        >
          {t("scheduleCancel")}
        </button>
      ) : null}

      {/* L'heure est dite en toutes lettres, en bas et sur toute la largeur —
          pas alignée avec les champs. Elle y ressemblait à un champ grisé, et
          un champ qui ne réagit pas au clic donne au client l'impression d'un
          droit qu'on lui retire. Écrite comme une phrase, elle redevient ce
          qu'elle est : le fonctionnement du service, énoncé une fois. */}
      {PUBLISH_HOUR_IS_CHOSEN ? null : (
        <p className="w-full text-[13px] text-muted">
          {t("scheduleFixedHour", { time: formatPublishTime(new Date(instant)) })}
        </p>
      )}

      {schedule.result.serverError ? (
        <p className="w-full text-sm text-danger">{schedule.result.serverError}</p>
      ) : null}
    </form>
  );
}

/** Aujourd'hui dans le fuseau de publication, au format du champ de date. */
function todayInParis(): string {
  return splitPublishInstant(new Date().toISOString()).day;
}
