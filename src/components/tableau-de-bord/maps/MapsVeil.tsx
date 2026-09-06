import type { GooglePlace, MapsAttributeAdvice } from "@/lib/apify/place-types";
import { GatePanel } from "../TierGate";
import { boxCount, type MapsTaskId } from "./maps-priorities";
import { placeChecks } from "./PlaceInsights";

/**
 * La correction sous voile : ce que la fiche dit aujourd'hui, et la place de ce
 * qui l'aurait remplacé.
 *
 * C'est le tiroir d'un chantier pour un compte gratuit. Il garde la grammaire
 * de la page payante — l'existant à gauche, la flèche, la proposition à droite
 * — et n'en change qu'une chose : la colonne de droite est vide, floutée, et
 * porte l'appel. Le client voit exactement où le travail se pose sur sa propre
 * fiche, et ce qu'il achète.
 *
 * Deux règles gouvernent ce fichier, et elles tiennent le produit :
 *
 *   — **Rien n'est rédigé.** Aucun appel au modèle ne part pour un compte
 *     gratuit sur cette page. La colonne « Proposé » ne cache pas un texte sous
 *     un flou : elle ne contient rien du tout, des barres grises. Un flou se
 *     retire dans un inspecteur ; une barre grise n'a rien à donner.
 *
 *   — **La gauche est vraie.** Le nom, la description, la présentation, les
 *     cases cochées, les champs remplis viennent du relevé de la fiche, qui a
 *     bien eu lieu. On ne fabrique pas l'état d'un commerce pour lui vendre une
 *     correction : ce qu'on lui montre de lui-même est exact, et c'est
 *     précisément ce qui rend le vide de droite désirable.
 */

type Veil = {
  /** L'étiquette de la colonne de gauche : ce qu'on lui montre de sa fiche. */
  label: string;
  current: React.ReactNode;
  /** Combien de barres grises à droite : la longueur du texte attendu. */
  lines: number;
};

export function MapsVeil({
  kind,
  place,
  attributes,
  coherenceMismatches,
}: {
  kind: MapsTaskId;
  place: GooglePlace;
  attributes: MapsAttributeAdvice[];
  coherenceMismatches: number;
}) {
  const veil = veilFor(kind, place, attributes, coherenceMismatches);
  if (!veil) return null;

  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
      <div className="rounded-2xl border border-border bg-mist/60 p-4">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-warning/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-warning ring-1 ring-inset ring-warning/25">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {veil.label}
        </span>
        <div className="mt-3">{veil.current}</div>
      </div>

      <Pivot />

      {/* Les deux couches partagent la case de grille, comme dans `TierGate` :
          l'appel donne sa hauteur au bloc, et les barres floutées ne repassent
          jamais par-dessus lui. */}
      <div className="relative isolate grid min-h-[210px] overflow-hidden rounded-2xl border border-obsidian/15 bg-surface">
        <div
          aria-hidden
          inert
          className="pointer-events-none select-none p-4 blur-[6px] [grid-area:1/1]"
        >
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-success">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
            Proposé
          </span>
          <div className="mt-3 space-y-2">
            {Array.from({ length: veil.lines }, (_, index) => (
              <span
                key={index}
                className="block h-3 rounded-full bg-mist"
                style={{ width: index === veil.lines - 1 ? "58%" : "100%" }}
              />
            ))}
          </div>
        </div>

        <div className="[grid-area:1/1]">
          <GatePanel offer="allin" item="mapsFix" />
        </div>
      </div>
    </div>
  );
}

/** Ce qui se montre à gauche, chantier par chantier — et jamais rien à droite. */
function veilFor(
  kind: MapsTaskId,
  place: GooglePlace,
  attributes: MapsAttributeAdvice[],
  coherenceMismatches: number,
): Veil | null {
  switch (kind) {
    case "name":
      return {
        label: "Votre nom aujourd'hui",
        current: <p className="text-sm font-medium leading-snug">{place.title}</p>,
        lines: 2,
      };

    case "description":
      return {
        label: "Votre description aujourd'hui",
        current: <Prose text={place.description} missing="Aucune description sur votre fiche." />,
        lines: 4,
      };

    case "about":
      return {
        label: "Votre présentation aujourd'hui",
        current: (
          <Prose
            text={place.ownerDescription}
            missing="Vous n'avez pas encore écrit de présentation."
          />
        ),
        lines: 8,
      };

    case "attributes": {
      const { checked, total } = boxCount(attributes);
      return {
        label: "Vos cases aujourd'hui",
        current: (
          <>
            <p className="text-sm">
              <span className="text-lg font-bold tabular-nums">{checked}</span>
              <span className="text-muted">
                {" "}
                cochées sur {total} que Google propose à votre catégorie.
              </span>
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {attributes
                .flatMap((group) => group.present)
                .slice(0, 8)
                .map((label) => (
                  <li
                    key={label}
                    className="rounded-pill bg-surface px-2.5 py-1 text-xs text-graphite ring-1 ring-inset ring-border"
                  >
                    {label}
                  </li>
                ))}
            </ul>
          </>
        ),
        lines: 6,
      };
    }

    case "fields": {
      const checks = placeChecks(place);
      const done = checks.filter((check) => check.ok).length;
      return {
        label: "Vos champs aujourd'hui",
        current: (
          <>
            <p className="text-sm">
              <span className="text-lg font-bold tabular-nums">
                {done}/{checks.length}
              </span>
              <span className="text-muted"> champs remplis sur votre fiche.</span>
            </p>
            <ul className="mt-3 space-y-1.5">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className={`size-1.5 shrink-0 rounded-full ${check.ok ? "bg-success" : "bg-danger"}`}
                  />
                  <span className={check.ok ? "text-muted" : "font-medium"}>{check.label}</span>
                </li>
              ))}
            </ul>
          </>
        ),
        lines: 6,
      };
    }

    case "coherence":
      return {
        label: "Fiche et site aujourd'hui",
        current: (
          <p className="text-sm leading-relaxed text-muted">
            {coherenceMismatches > 0
              ? `${coherenceMismatches} ligne${coherenceMismatches > 1 ? "s de votre fiche contredisent" : " de votre fiche contredit"} votre site : le nom, l'adresse, les horaires ou le téléphone.`
              : "Nous recoupons le nom, l'adresse, les horaires et le téléphone de votre fiche avec ceux de votre site."}
          </p>
        ),
        lines: 5,
      };

    // Les avis et les posts ont leur carte plus bas : leur voile est posé là,
    // sur l'atelier lui-même, pas dans un tiroir.
    default:
      return null;
  }
}

function Prose({ text, missing }: { text: string | null; missing: string }) {
  if (!text) return <p className="text-sm italic text-muted">{missing}</p>;

  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed">
          {paragraph}
        </p>
      ))}
      <p className="pt-1 text-[11px] tabular-nums text-ash">{text.length} signes</p>
    </div>
  );
}

/** La flèche du « devient », reprise de `ListingCompare` au trait près. */
function Pivot() {
  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:h-full lg:flex-col lg:py-6">
      <span
        aria-hidden
        className="h-px flex-1 border-t border-dashed border-pebble lg:h-auto lg:w-px lg:border-l lg:border-t-0"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 rotate-90 text-steel lg:rotate-0"
          role="img"
          aria-label="devient"
        >
          <path d="M4 12h15" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </span>
      <span
        aria-hidden
        className="h-px flex-1 border-t border-pebble lg:h-auto lg:w-px lg:border-l lg:border-t-0"
      />
    </div>
  );
}
