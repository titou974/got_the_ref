import { getTranslations } from "next-intl/server";
import {
  RiGlobalLine,
  RiMapPin2Line,
  RiPriceTag3Line,
  RiSearchLine,
} from "@remixicon/react";

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
 * Chaque valeur porte sa pastille : l'étiquette pour la niche, l'épingle pour
 * une zone où l'on se rend, le globe pour un commerce en ligne. Le pictogramme
 * ne décore pas — il dit de quelle nature est la donnée avant qu'on ait lu son
 * intitulé, et c'est ce qui permet de reconnaître le couple d'un coup d'œil.
 *
 * Le bandeau se referme sur la requête elle-même, celle qui est réellement
 * partie chez ChatGPT et Gemini. Les deux valeurs du haut en sont les
 * ingrédients ; la ligne du bas est la question posée, et les classements qui
 * suivent en sont la réponse. Sans requête enregistrée, la phrase d'explication
 * tient seule cette place, comme avant.
 *
 * Sans niche, pas de bandeau. Un cadre vide surmonté de « niche détectée »
 * dirait exactement le contraire de ce qu'il est là pour dire.
 */
export async function NicheBand({
  niche,
  location,
  isPhysical,
  query = null,
}: {
  /** La niche détectée au crawl, telle qu'elle part dans les requêtes. */
  niche: string | null;
  /** La ville ou la zone détectée, pour un commerce qui reçoit du public. */
  location: string | null;
  isPhysical: boolean;
  /**
   * La requête réellement envoyée aux moteurs lors du relevé. On l'affiche
   * telle quelle : la reconstruire à partir de la niche et de la zone
   * donnerait une phrase vraisemblable mais fausse, et c'est précisément la
   * carte qui promet de montrer ce qui a été demandé.
   */
  query?: string | null;
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
        <Cell label={t("nicheLabel")} value={niche} icon={<RiPriceTag3Line className="size-4" aria-hidden />} />

        {zone ? (
          <>
            <span
              aria-hidden
              className="block h-px w-full bg-border sm:h-auto sm:w-px sm:shrink-0"
            />
            <Cell
              label={isPhysical ? t("zoneLabel") : t("zoneLabelOnline")}
              value={zone}
              icon={
                isPhysical ? (
                  <RiMapPin2Line className="size-4" aria-hidden />
                ) : (
                  <RiGlobalLine className="size-4" aria-hidden />
                )
              }
            />
          </>
        ) : null}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        {query ? (
          /* La requête dans sa barre de recherche : le seul endroit du tableau
             de bord où l'on montre littéralement ce qu'on a tapé. La forme dit
             ce que le texte ferait en trois mots de plus. */
          <p className="flex items-center gap-2.5 rounded-pill bg-mist px-3.5 py-2.5">
            <RiSearchLine className="size-4 shrink-0 text-steel" aria-hidden />
            <span className="min-w-0 text-pretty text-sm font-medium text-text">{query}</span>
          </p>
        ) : null}

        <p className={`text-sm text-muted ${query ? "mt-2.5" : ""}`}>{t("note")}</p>
      </div>
    </section>
  );
}

/**
 * Une pastille, un intitulé en petites capitales, et la valeur au corps d'un
 * titre. La pastille reprend la grammaire des mots d'accueil : disque noir,
 * pictogramme blanc — c'est la marque de ce qui a été détecté, pas mesuré.
 */
function Cell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 sm:flex-1">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-obsidian text-white"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">{label}</p>
        <p className="mt-1 text-balance text-2xl font-bold leading-tight sm:text-[28px]">
          {value}
        </p>
      </div>
    </div>
  );
}
