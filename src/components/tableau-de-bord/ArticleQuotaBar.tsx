import type { ArticleQuota } from "@/features/dashboard/queries";

/**
 * Le budget de rédaction, affiché avant que le client le découvre en cliquant.
 *
 * La limite existe pour tenir le rythme de publication et le coût des grands
 * modèles ; elle n'a d'intérêt que si elle se voit d'avance. Un client qui sait
 * qu'il lui reste une rédaction la garde pour l'article qui compte, là où un
 * refus au troisième clic se lit comme une panne.
 *
 * Deux budgets se lisent ici, et il faut les distinguer. L'abonné a une fenêtre
 * glissante qui se renouvelle — d'où la date de reprise. Le Coup de Boost, lui,
 * a une semaine et puis c'est tout : `renewsAt` est alors nul, et promettre une
 * date à qui n'en aura pas serait le pire des messages.
 */
export function ArticleQuotaBar({ quota }: { quota: ArticleQuota }) {
  const exhausted = quota.remaining <= 0;
  /** Épuisé sans reprise : la semaine payée s'est refermée. */
  const closed = exhausted && !quota.renewsAt;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-border bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {closed
            ? "Semaine de rédaction terminée"
            : exhausted
              ? "Rédactions de la semaine épuisées"
              : `${quota.remaining} rédaction${quota.remaining > 1 ? "s" : ""} disponible${
                  quota.remaining > 1 ? "s" : ""
                } cette semaine`}
        </p>
        <p className="mt-1 text-sm text-muted">
          {closed
            ? `Les ${quota.limit} articles de votre Coup de Boost ont été écrits. L'abonnement Tout-en-un reprend la publication dans la durée ; vos brouillons restent modifiables.`
            : exhausted && quota.renewsAt
              ? `La prochaine se libère le ${quota.renewsAt.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}. Vos brouillons restent modifiables d'ici là.`
              : `${quota.used} sur ${quota.limit} utilisées sur les sept derniers jours. Une reprise compte comme une rédaction.`}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-1.5" aria-hidden>
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
