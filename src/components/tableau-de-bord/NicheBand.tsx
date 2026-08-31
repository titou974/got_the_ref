import { getTranslations } from "next-intl/server";

/**
 * Ce que nous avons compris du commerce, juste avant de dire où il se classe.
 *
 * La niche et la zone ne sont pas deux étiquettes de plus sur un tableau de
 * bord : ce sont les deux axes de la requête envoyée aux moteurs. « Où suis-je
 * classé » n'a de sens qu'une fois qu'on a lu « classé sur quoi, et où ». D'où
 * la place du bandeau, collé au-dessus des classements plutôt que rangé dans
 * l'en-tête avec le domaine et la date.
 *
 * C'est aussi la preuve que la lecture a eu lieu. Un client qui reconnaît sa
 * niche écrite en toutes lettres — « Restaurant de fruits de mer », pas
 * « Restauration » — sait que quelque chose a vraiment lu son site. C'est la
 * seule donnée détectée du tableau de bord à qui l'on accorde un corps de
 * titre : tout le reste de l'écran se lit en 14 ou 16 px.
 *
 * Sans niche, pas de bandeau. Un cadre vide surmonté de « niche détectée »
 * dirait exactement le contraire de ce qu'il est là pour dire.
 */
export async function NicheBand({
  niche,
  location,
  isPhysical,
}: {
  /** La niche détectée au crawl, telle qu'elle part dans les requêtes. */
  niche: string | null;
  /** La ville ou la zone détectée, pour un commerce qui reçoit du public. */
  location: string | null;
  isPhysical: boolean;
}) {
  const t = await getTranslations("dashboard.niche");

  if (!niche) return null;

  const zone = isPhysical ? location : t("zoneOnline");

  return (
    <section className="rounded-[28px] border border-border bg-surface p-5 sm:p-6">
      {/* Les deux valeurs sont posées côte à côte, séparées d'un filet : c'est
          un couple, pas une liste. Sur téléphone elles s'empilent et le filet
          bascule à l'horizontale. */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-8">
        <Cell label={t("nicheLabel")} value={niche} />

        {zone ? (
          <>
            <span
              aria-hidden
              className="block h-px w-full bg-border sm:h-auto sm:w-px sm:shrink-0"
            />
            <Cell label={isPhysical ? t("zoneLabel") : t("zoneLabelOnline")} value={zone} />
          </>
        ) : null}
      </div>

      <p className="mt-5 border-t border-border pt-4 text-sm text-muted">{t("note")}</p>
    </section>
  );
}

/** Un intitulé en petites capitales, et sa valeur au corps d'un titre. */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 sm:flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">{label}</p>
      <p className="mt-1.5 text-balance text-2xl font-bold leading-tight sm:text-[28px]">
        {value}
      </p>
    </div>
  );
}
