"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { AreaField, PillField } from "@/components/onboarding/Field";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { StepPending } from "@/components/onboarding/StepPending";
import { saveDescriptionAction } from "@/features/onboarding/actions";

/**
 * Étape 4 — l'activité racontée par le client.
 *
 * Les champs arrivent préremplis par ce que la lecture du site a compris. C'est
 * volontaire : corriger deux mots dans une phrase déjà écrite prend dix
 * secondes, écrire un paragraphe devant un champ vide en prend cinq minutes —
 * et beaucoup abandonnent là.
 *
 * Valider lance aussi la recherche des concurrents, d'où l'attente annoncée sur
 * le bouton.
 */
export function DescriptionForm({
  initialDescription,
  initialAudience,
  initialNiche,
}: {
  initialDescription: string | null;
  initialAudience: string | null;
  initialNiche: string | null;
}) {
  const [description, setDescription] = useState(initialDescription ?? "");
  const [audience, setAudience] = useState(initialAudience ?? "");
  const [niche, setNiche] = useState(initialNiche ?? "");
  const { execute, isPending, result } = useAction(saveDescriptionAction);

  const errors = result.validationErrors;

  // Enregistrer la description enchaîne sur la recherche des concurrents : la
  // carte annonce ce travail-là, qui est celui qui prend du temps.
  if (isPending) return <StepPending kind="competitors" title="Nous cherchons vos concurrents" />;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        execute({ description, audience, niche });
      }}
    >
      <AreaField
        name="description"
        label="Votre activité"
        rows={5}
        placeholder="Ce que vous vendez, depuis quand, ce qui vous distingue des autres."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors?.description?._errors?.[0]}
      />

      <PillField
        name="audience"
        label="Votre clientèle"
        placeholder="Familles du quartier, PME du bâtiment, jeunes parents…"
        value={audience}
        onChange={(event) => setAudience(event.target.value)}
        error={errors?.audience?._errors?.[0]}
      />

      <PillField
        name="niche"
        label="Votre niche"
        placeholder="Boulangerie bio, plomberie d'urgence, coaching sportif…"
        value={niche}
        onChange={(event) => setNiche(event.target.value)}
        error={errors?.niche?._errors?.[0]}
        hint="Le plus précis possible : c'est là-dessus que se joue votre place dans les réponses des IA."
      />

      {result.serverError && <p className="text-sm text-danger">{result.serverError}</p>}

      <StepFooter
        pendingLabel="Recherche de vos concurrents…"
        disabled={description.trim().length < 20 || audience.trim().length < 3 || niche.trim().length < 2}
        pending={isPending}
      />
    </form>
  );
}
