"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { PillField } from "@/components/onboarding/Field";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { saveToneAction, skipStepAction } from "@/features/onboarding/actions";

/**
 * Étape 6 — la couleur de marque et un article donné en exemple.
 *
 * L'article compte plus que la couleur : c'est lui qui apprend aux agents à
 * écrire comme le client écrit — quelle personne il emploie, s'il tutoie, s'il
 * plaisante. Sans ce repère, les textes produits sonnent comme ceux de tout le
 * monde, et c'est exactement ce qu'un moteur de réponse ne cite pas.
 */
export function ToneForm({
  initialColor,
  initialSampleUrl,
}: {
  initialColor: string | null;
  initialSampleUrl: string | null;
}) {
  const [color, setColor] = useState(initialColor ?? "");
  const [sampleUrl, setSampleUrl] = useState(initialSampleUrl ?? "");
  const save = useAction(saveToneAction);
  const skip = useAction(skipStepAction);

  return (
    <form
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        save.execute({ brandColor: color, toneSampleUrl: sampleUrl });
      }}
    >
      <div>
        <p className="mb-3 text-sm font-medium text-muted">Couleur principale</p>

        {/* Aucune palette proposée : les seules couleurs affichées ici sont
            celles du client. Une rangée de pastilles maison le pousserait vers
            une teinte qui n'est pas la sienne, et introduirait dans l'interface
            des couleurs que la charte n'a pas. */}
        <div className="flex items-center gap-3 rounded-pill border border-obsidian/25 bg-snow py-2 pl-2 pr-5">
          <label className="cursor-pointer">
            <span className="sr-only">Choisir votre couleur principale</span>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#09090b"}
              onChange={(event) => setColor(event.target.value)}
              className="h-11 w-11 cursor-pointer rounded-full border-none bg-transparent p-0"
            />
          </label>

          <input
            type="text"
            name="brandColor"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            placeholder="#09090B"
            spellCheck={false}
            className="w-full bg-transparent text-base uppercase tracking-wide text-text placeholder:text-ash focus:outline-none"
          />
        </div>

        {save.result.validationErrors?.brandColor?._errors?.[0] && (
          <p className="mt-2 px-2 text-sm text-danger">
            {save.result.validationErrors.brandColor._errors[0]}
          </p>
        )}
      </div>

      <PillField
        name="toneSampleUrl"
        label="Un texte qui vous ressemble"
        placeholder="Lien vers un de vos articles ou une page « à propos »"
        value={sampleUrl}
        onChange={(event) => setSampleUrl(event.target.value)}
        error={save.result.validationErrors?.toneSampleUrl?._errors?.[0]}
        hint="Nous le lisons pour retrouver votre manière d'écrire. Le texte n'est pas conservé."
      />

      {save.result.serverError && <p className="text-sm text-danger">{save.result.serverError}</p>}

      <StepFooter
        pendingLabel={sampleUrl ? "Lecture de votre texte…" : "Un instant…"}
        pending={save.isPending || skip.isPending}
        onSkip={() => skip.execute({ step: "tonalite" })}
      />
    </form>
  );
}
