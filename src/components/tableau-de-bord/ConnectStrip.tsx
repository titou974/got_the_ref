import { useTranslations } from "next-intl";

/**
 * Les deux rattachements, en tête du tableau de bord : annoncés, pas encore
 * ouverts.
 *
 * Google Analytics et le rattachement du site arrivent dans les prochains
 * jours. En attendant, ces deux cartes disent où en est le chantier plutôt que
 * d'ouvrir un formulaire qui laisserait le client devant un écran d'erreur au
 * retour de Google, ou devant des identifiants demandés pour rien.
 *
 * Ce n'est pas une impasse : le prompt de correction, en bas de chaque page,
 * fait aujourd'hui le travail que ces rattachements automatiseront. Les cartes
 * y renvoient explicitement — un « bientôt » sans porte de sortie se lit comme
 * une fonctionnalité manquante, un « bientôt » avec le geste à faire en
 * attendant se lit comme une feuille de route.
 */

const cardClass =
  "flex flex-col gap-3 rounded-[28px] border border-border bg-surface p-5 sm:p-6 opacity-95";

export function ConnectStrip() {
  const t = useTranslations("dashboard.connect");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SoonCard
        title={t("analytics.title")}
        body={t("analytics.body")}
        detail={t("analytics.soonDetail")}
        badge={t("soon")}
      />
      <SoonCard
        title={t("site.title")}
        body={t("site.body")}
        detail={t("site.soonDetail")}
        badge={t("soon")}
      />
    </div>
  );
}

function SoonCard({
  title,
  body,
  detail,
  badge,
}: {
  title: string;
  body: string;
  detail: string;
  badge: string;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
        <span className="shrink-0 rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
          {badge}
        </span>
      </div>

      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}
