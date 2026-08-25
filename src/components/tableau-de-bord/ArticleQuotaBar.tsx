import type { ArticleQuota } from "@/features/dashboard/queries";

/**
 * Le budget de rédaction de la semaine, affiché avant que le client le
 * découvre en cliquant.
 *
 * La limite existe pour tenir le rythme de publication et le coût des grands
 * modèles ; elle n'a d'intérêt que si elle se voit d'avance. Un client qui sait
 * qu'il lui reste une rédaction la garde pour l'article qui compte, là où un
 * refus au troisième clic se lit comme une panne.
 */
export function ArticleQuotaBar({ quota }: { quota: ArticleQuota }) {
  const exhausted = quota.remaining <= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-border bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {exhausted
            ? "Rédactions de la semaine épuisées"
            : `${quota.remaining} rédaction${quota.remaining > 1 ? "s" : ""} disponible${
                quota.remaining > 1 ? "s" : ""
              } cette semaine`}
        </p>
        <p className="mt-1 text-sm text-muted">
          {exhausted && quota.renewsAt
            ? `La prochaine se libère le ${quota.renewsAt.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}. Vos brouillons restent modifiables d'ici là.`
            : `${quota.used} sur ${quota.limit} utilisées sur les sept derniers jours. Une reprise compte comme une rédaction.`}
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5" aria-hidden>
        {Array.from({ length: quota.limit }, (_, index) => (
          <span
            key={index}
            className={`h-2.5 w-8 rounded-full ${index < quota.used ? "bg-pebble" : "bg-obsidian"}`}
          />
        ))}
      </div>
    </div>
  );
}
