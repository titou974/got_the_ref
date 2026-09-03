import { RiCheckLine } from "@remixicon/react";
import type { MapsAttributeAdvice } from "@/lib/apify/place-types";
import { Card, CardTitle } from "../Card";

/**
 * Les cases que Google propose, groupe par groupe : celles qui sont cochées,
 * celles qui manquent.
 *
 * La fiche Google est elle-même une suite d'étiquettes, et c'est cette forme
 * qu'on garde : chaque groupe est une rangée où le coché est plein et le
 * manquant en pointillé. Un tableau à deux colonnes dirait la même chose, mais
 * il faudrait le lire ligne à ligne ; ici, le trou dans la rangée se voit d'un
 * coup d'œil — « il me manque trois cases dans Paiements ».
 *
 * L'ordre encode le travail qui reste : les groupes incomplets d'abord, dépliés,
 * puis les groupes complets réduits à une ligne. Quatorze rangées dépliées
 * feraient une colonne qu'on ne lit pas, et ce sont les manques qui appellent
 * une action.
 *
 * Une case vide n'apparaît pas sur la fiche publique. C'est pour ça que le
 * commerçant ne sait pas qu'il l'a laissée derrière lui, et c'est tout l'objet
 * de cet écran.
 */
export function AttributeRows({ groups }: { groups: MapsAttributeAdvice[] }) {
  const filled = groups.filter((group) => group.present.length + group.suggested.length > 0);
  if (filled.length === 0) return null;

  const incomplete = filled.filter((group) => group.suggested.length > 0);
  const complete = filled.filter((group) => group.suggested.length === 0);

  const missing = incomplete.reduce((sum, group) => sum + group.suggested.length, 0);
  const checked = filled.reduce((sum, group) => sum + group.present.length, 0);

  return (
    <Card>
      <CardTitle
        title="Les cases de votre fiche"
        hint={
          missing === 0
            ? "Tout ce que Google propose pour votre activité est coché."
            : "En pointillé, ce que Google propose et que votre fiche ne dit pas encore."
        }
        action={
          <span className="rounded-xl bg-mist px-3 py-1 text-sm font-semibold tabular-nums">
            {checked}/{checked + missing}
          </span>
        }
      />

      <dl className="divide-y divide-border">
        {incomplete.map((group) => (
          <div key={group.group} className="py-4 first:pt-0">
            <dt className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{group.group}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {group.suggested.length} à cocher
              </span>
            </dt>

            <dd>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {group.present.map((label) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-mist px-3 py-1.5 text-sm text-text"
                  >
                    <RiCheckLine size={14} className="shrink-0 text-success" />
                    {label}
                  </li>
                ))}

                {group.suggested.map((item) => (
                  <li
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-graphite/40 px-3 py-1.5 text-sm text-graphite"
                  >
                    <span aria-hidden className="text-base leading-none text-ash">
                      +
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>

              {/* La raison de chaque case proposée, une fois sous la rangée. En
                  infobulle, elle ne se lirait pas au doigt ; dans l'étiquette,
                  elle ferait une rangée illisible. */}
              {group.suggested.some((item) => item.why) ? (
                <ul className="mt-3 space-y-1 border-l-2 border-border pl-3">
                  {group.suggested
                    .filter((item) => item.why)
                    .map((item) => (
                      <li key={item.label} className="text-xs text-muted">
                        <span className="font-medium text-text">{item.label}</span> — {item.why}
                      </li>
                    ))}
                </ul>
              ) : null}
            </dd>
          </div>
        ))}

        {/* Les groupes complets : une ligne chacun. Rien à y faire, mais les
            masquer laisserait croire que Google ne propose que le reste. */}
        {complete.map((group) => (
          <div
            key={group.group}
            className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0"
          >
            <dt className="flex min-w-0 items-center gap-2 text-sm">
              <RiCheckLine size={15} className="shrink-0 text-success" />
              <span className="truncate">{group.group}</span>
            </dt>
            <dd className="shrink-0 text-xs text-muted">
              {group.present.length} case{group.present.length > 1 ? "s" : ""} cochée
              {group.present.length > 1 ? "s" : ""}
            </dd>
          </div>
        ))}
      </dl>

      {/* Ce que Google propose mais qui ne correspond pas à ce commerce, rangé
          en fin de carte : le client le lit une fois, et n'y revient plus. */}
      <SkippedNote groups={filled} />
    </Card>
  );
}

function SkippedNote({ groups }: { groups: MapsAttributeAdvice[] }) {
  const skipped = groups.flatMap((group) => group.skipped);
  if (skipped.length === 0) return null;

  return (
    <details className="mt-4 border-t border-border pt-3">
      <summary className="cursor-pointer text-xs text-muted marker:text-ash">
        {skipped.length} cases écartées, sans rapport avec votre activité
      </summary>
      <p className="mt-2 text-xs text-ash">{skipped.join(" · ")}</p>
    </details>
  );
}
