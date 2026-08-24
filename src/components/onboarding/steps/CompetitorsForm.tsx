"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { CheckCards } from "@/components/onboarding/RadioCards";
import { StepFooter } from "@/components/onboarding/StepFooter";
import {
  refreshCompetitorsAction,
  saveCompetitorsAction,
  skipStepAction,
} from "@/features/onboarding/actions";

type Competitor = {
  id: string;
  name: string;
  url: string | null;
  domain: string | null;
  reason: string | null;
  selected: boolean;
};

/**
 * Étape 5 — les concurrents proposés.
 *
 * Tout est coché en arrivant : le client retire ce qui ne le concerne pas, il
 * n'a pas à reconstituer une liste qu'on vient de lui soumettre. Décocher est
 * un geste, cocher cinq cases en est cinq.
 *
 * La relance existe parce qu'un modèle se trompe de secteur de temps en temps,
 * et qu'un client devant cinq noms inconnus abandonnerait l'étape faute de
 * pouvoir corriger.
 */
export function CompetitorsForm({ competitors }: { competitors: Competitor[] }) {
  const [selected, setSelected] = useState<string[]>(
    competitors.filter((competitor) => competitor.selected).map((competitor) => competitor.id),
  );
  const save = useAction(saveCompetitorsAction);
  const refresh = useAction(refreshCompetitorsAction);
  const skip = useAction(skipStepAction);

  if (competitors.length === 0) {
    return (
      <div className="space-y-5">
        <p className="rounded-[24px] border border-fog bg-snow px-5 py-6 text-sm leading-relaxed text-muted">
          Nous n&apos;avons pas réussi à établir cette liste. Ce n&apos;est pas bloquant : vos
          concurrents seront repérés au fil des analyses.
        </p>

        <button
          type="button"
          onClick={() => refresh.execute({})}
          disabled={refresh.isPending}
          className="w-full cursor-pointer rounded-pill border border-obsidian/20 bg-snow px-6 py-3.5 text-sm font-medium transition-colors duration-200 hover:border-obsidian disabled:cursor-not-allowed disabled:text-ash"
        >
          {refresh.isPending ? "Recherche en cours…" : "Réessayer"}
        </button>

        {/* Pas de formulaire ici : rien à soumettre, seulement une étape à
            passer — le bouton déclenche donc l'action directement. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            skip.execute({ step: "concurrents" });
          }}
        >
          <StepFooter label="Continuer sans concurrents" pending={skip.isPending} />
        </form>
      </div>
    );
  }

  const options = competitors.map((competitor) => ({
    value: competitor.id,
    label: competitor.name,
    description: [competitor.domain, competitor.reason].filter(Boolean).join(" · ") || undefined,
  }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.execute({ selected });
      }}
    >
      <CheckCards
        name="competitors"
        options={options}
        values={selected}
        onToggle={(id) =>
          setSelected((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
      />

      <button
        type="button"
        onClick={() => refresh.execute({})}
        disabled={refresh.isPending}
        className="mt-4 w-full cursor-pointer rounded-pill border border-obsidian/20 bg-snow px-6 py-3.5 text-sm font-medium transition-colors duration-200 hover:border-obsidian disabled:cursor-not-allowed disabled:text-ash"
      >
        {refresh.isPending ? "Recherche en cours…" : "Proposer une autre liste"}
      </button>

      {(save.result.serverError || refresh.result.serverError) && (
        <p className="mt-4 text-sm text-danger">
          {save.result.serverError ?? refresh.result.serverError}
        </p>
      )}

      <StepFooter
        pending={save.isPending || skip.isPending}
        onSkip={() => skip.execute({ step: "concurrents" })}
      />
    </form>
  );
}
