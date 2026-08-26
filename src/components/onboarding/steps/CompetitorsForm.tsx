"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { CheckCards } from "@/components/onboarding/RadioCards";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { StepPending } from "@/components/onboarding/StepPending";
import { SearchLoader } from "@/components/SearchLoader";
import { refreshCompetitorsAction, skipStepAction, saveCompetitorsAction } from "@/features/onboarding/actions";

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
 * La recherche part d'ici, à l'arrivée sur l'étape, et non depuis le bouton de
 * l'étape précédente. Le client voit donc l'écran qu'il attend, avec l'attente
 * annoncée dessus, au lieu de patienter devant un bouton figé sans savoir ce
 * qui se passe. Elle n'est lancée qu'une fois, et seulement si rien n'est
 * enregistré : revenir en arrière ne redéclenche pas un appel payant.
 *
 * Tout est coché en arrivant : le client retire ce qui ne le concerne pas, il
 * n'a pas à reconstituer une liste qu'on vient de lui soumettre. Décocher est
 * un geste, cocher cinq cases en est cinq.
 */
export function CompetitorsForm({ competitors }: { competitors: Competitor[] }) {
  const router = useRouter();
  const [list, setList] = useState<Competitor[]>(competitors);
  const [selected, setSelected] = useState<string[]>(
    competitors.filter((competitor) => competitor.selected).map((competitor) => competitor.id),
  );

  const save = useAction(saveCompetitorsAction);
  const skip = useAction(skipStepAction);
  const refresh = useAction(refreshCompetitorsAction, {
    onSuccess: ({ data }) => {
      const found = data?.competitors ?? [];
      setList(found);
      setSelected(found.filter((competitor) => competitor.selected).map((c) => c.id));
      // Remet le rendu serveur d'accord avec ce qui est à l'écran : sans cela,
      // un retour sur l'étape réafficherait la liste précédente.
      router.refresh();
    },
  });

  // Première visite sans liste enregistrée : on cherche tout de suite. Le
  // garde-fou évite qu'un double rendu ne lance deux appels.
  const started = useRef(competitors.length > 0);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    refresh.execute({});
  }, [refresh]);

  const searching = refresh.isPending;
  const failed = Boolean(refresh.result.serverError) && !searching;

  if (save.isPending || skip.isPending) {
    return <StepPending title="Nous retenons vos concurrents" />;
  }

  if (searching) {
    return (
      <div className="space-y-5">
        <SearchLoader kind="competitors" title="Nous cherchons vos concurrents" />
        <p className="text-center text-sm text-muted">
          Gardez cet onglet ouvert, la liste s&apos;affiche ici dès qu&apos;elle est prête.
        </p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="space-y-5">
        <p className="rounded-[24px] border border-fog bg-snow px-5 py-6 text-sm leading-relaxed text-muted">
          {failed
            ? refresh.result.serverError
            : "Nous n'avons pas réussi à établir cette liste. Ce n'est pas bloquant : vos concurrents seront repérés au fil des analyses."}
        </p>

        <button
          type="button"
          onClick={() => refresh.execute({})}
          className="w-full cursor-pointer rounded-pill border border-obsidian/20 bg-snow px-6 py-3.5 text-sm font-medium transition-colors duration-200 hover:border-obsidian"
        >
          Réessayer
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

  // Le domaine passe à côté du nom, la raison en dessous. Collés par un « · »
  // sur une seule ligne, les deux se lisaient comme une même phrase et le
  // domaine — le seul élément qui permet de reconnaître l'enseigne — se perdait
  // au milieu.
  const options = list.map((competitor) => ({
    value: competitor.id,
    label: competitor.name,
    hint: competitor.domain ?? undefined,
    description: competitor.reason ?? undefined,
  }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.execute({ selected });
      }}
    >
      {/* Le compte, dit avant la liste : la recherche en rend cinq comme huit
          selon ce qu'elle a trouvé, et un client qui en attendait un nombre
          fixe doit voir que la liste est courte parce qu'elle est vraie. */}
      <p className="mb-4 text-sm text-muted">
        {list.length === 1
          ? "1 concurrent trouvé sur le web."
          : `${list.length} concurrents trouvés sur le web.`}
      </p>

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
        className="mt-4 w-full cursor-pointer rounded-pill border border-obsidian/20 bg-snow px-6 py-3.5 text-sm font-medium transition-colors duration-200 hover:border-obsidian"
      >
        Proposer une autre liste
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
