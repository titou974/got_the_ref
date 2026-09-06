import type { GooglePlace, MapsAdvice } from "@/lib/apify/place-types";
import { StatusDot } from "../Card";

/**
 * Les deux relevés de la colonne de droite : ce qui se contredit, et où en sont
 * les textes.
 *
 * Ni l'un ni l'autre ne porte d'action, et aucun ne mène nulle part : les
 * corrections sont dans la liste de chantiers, à gauche, chacune dans son
 * tiroir. Ce sont des voyants — trois lignes qu'on lit d'un coup d'œil en
 * passant, pour savoir si l'écart s'est refermé depuis la dernière fois.
 */

type CoherenceMatch = { label: string; consistent: boolean; detail: string };

export function CoherenceNote({ matches }: { matches: CoherenceMatch[] }) {
  if (matches.length === 0) return null;

  const broken = matches.filter((match) => !match.consistent);
  const sorted = [...matches].sort((a, b) => Number(a.consistent) - Number(b.consistent));

  return (
    <div className="rounded-3xl border border-border bg-surface p-[18px]">
      <h2 className="text-sm font-semibold">Fiche ↔ site</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {broken.length === 0
          ? "Les deux disent la même chose."
          : `${broken.length} ligne${broken.length > 1 ? "s se contredisent" : " se contredit"}.`}
      </p>

      <ul className="mt-3 space-y-2.5 text-[13px]">
        {sorted.slice(0, 5).map((match) => (
          <li key={match.label} className="flex items-center gap-2.5">
            <StatusDot status={match.consistent ? "ok" : "ko"} />
            <span className="min-w-0 flex-1 truncate">{match.label}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}

type TextState = { label: string; tone: "empty" | "proposed" | "ok"; badge: string };

export function TextsNote({
  place,
  advice,
  locked = false,
}: {
  place: GooglePlace;
  advice: MapsAdvice | null;
  /**
   * Aucune réécriture n'a été demandée, et il n'y en aura pas avant
   * l'abonnement : un texte présent se dit alors « Écrit », jamais « Conforme »
   * — conforme à quoi, puisque rien n'a été proposé ?
   */
  locked?: boolean;
}) {
  const rows: TextState[] = [
    state("Le nom", place.title, advice?.title ?? null, locked),
    state("Description courte", place.description, advice?.description ?? null, locked),
    state("« À propos »", place.ownerDescription, advice?.about ?? null, locked),
  ];

  return (
    <div className="rounded-3xl border border-border bg-surface p-[18px]">
      <h2 className="text-sm font-semibold">Vos textes</h2>

      <ul className="mt-3 space-y-3 text-[13px]">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2.5">
            <span className="min-w-0 truncate">{row.label}</span>
            <span
              className={`shrink-0 rounded-pill px-2.5 py-[2px] text-[11px] font-semibold ${
                row.tone === "empty"
                  ? "bg-danger/10 text-danger"
                  : row.tone === "proposed"
                    ? "bg-success/10 text-success"
                    : "bg-mist text-muted"
              }`}
            >
              {row.badge}
            </span>
          </li>
        ))}
      </ul>

    </div>
  );
}

/** Vide sur la fiche, réécrit ici, ou tel quel : les trois seuls états d'un texte. */
function state(
  label: string,
  current: string | null,
  proposed: string | null,
  locked: boolean,
): TextState {
  if (!current) return { label, tone: "empty", badge: "Vide" };
  if (locked) return { label, tone: "ok", badge: "Écrit" };
  if (proposed && proposed.trim() !== current.trim()) {
    return { label, tone: "proposed", badge: "Proposé" };
  }
  return { label, tone: "ok", badge: "Conforme" };
}
