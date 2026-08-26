"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { PillField } from "@/components/onboarding/Field";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { StepPending } from "@/components/onboarding/StepPending";
import { saveToneAction, skipStepAction } from "@/features/onboarding/actions";

/**
 * Étape 6, la dernière — la couleur de marque et, si le client en a un sous la
 * main, un article donné en exemple.
 *
 * Le lien n'est plus nécessaire. Le site a été crawlé à l'étape 2 : s'il publie
 * des articles, on en lit un ; sinon on lit sa page d'accueil. C'est de là que
 * les agents tirent la manière d'écrire du client — quelle personne il emploie,
 * s'il tutoie, s'il plaisante. Sans ce repère, les textes produits sonnent
 * comme ceux de tout le monde, et c'est exactement ce qu'un moteur de réponse
 * ne cite pas. Le champ reste offert parce que le client sait mieux que nous
 * quel texte le représente.
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

  if (save.isPending || skip.isPending) {
    return <StepPending kind="writing" title="Nous lisons votre manière d'écrire" />;
  }

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
        label="Un texte qui vous ressemble (facultatif)"
        placeholder="Lien vers un de vos articles ou une page « à propos »"
        value={sampleUrl}
        onChange={(event) => setSampleUrl(event.target.value)}
        error={save.result.validationErrors?.toneSampleUrl?._errors?.[0]}
        hint="Sans lien, nous lisons un de vos articles ou, à défaut, votre page d'accueil pour retrouver votre manière d'écrire. Le texte n'est pas conservé."
      />

      {save.result.serverError && <p className="text-sm text-danger">{save.result.serverError}</p>}

      {/* Dernière étape du tunnel : le bouton annonce la destination plutôt
          qu'un « Continuer » qui laisserait croire qu'il en reste. */}
      <StepFooter
        label="Ouvrir mon tableau de bord"
        pendingLabel="Lecture de vos textes…"
        pending={save.isPending || skip.isPending}
        onSkip={() => skip.execute({ step: "tonalite" })}
        skipLabel="Passer et ouvrir mon tableau de bord"
      />
    </form>
  );
}
