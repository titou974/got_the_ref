"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { StepPending } from "@/components/onboarding/StepPending";
import { saveBusinessKindAction } from "@/features/onboarding/actions";
import { ONBOARDING_BUSINESS_KINDS } from "@/features/onboarding/steps";

/**
 * Étape 1 — le commerce reçoit-il du public ?
 *
 * Cette réponse commande la suite : elle décide si l'on réclame une fiche Google
 * Maps, si le crawl cherche des villes, et si les classements se relèvent sur
 * une zone ou sur le web entier. D'où sa place en tête, avant même l'adresse du
 * site.
 *
 * Les deux réponses sont posées côte à côte, à taille égale, plutôt qu'empilées.
 * Une liste verticale se lit comme un classement — la première option passe pour
 * la bonne réponse. Ici il n'y a pas de bonne réponse, seulement deux commerces
 * différents, et la mise en page doit le dire avant qu'on ait lu un mot.
 */

type Kind = (typeof ONBOARDING_BUSINESS_KINDS)[number];

const OPTIONS: {
  value: Kind;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "physical",
    label: "Un commerce physique",
    description:
      "Boutique, restaurant, artisan, cabinet, agence. Vos clients poussent la porte, et les IA doivent vous situer sur une ville.",
    icon: <StoreIcon />,
  },
  {
    value: "online",
    label: "Un commerce en ligne",
    description:
      "Boutique en ligne, logiciel, service à distance. Aucune adresse à visiter : votre marché est le web, pas un quartier.",
    icon: <GlobeIcon />,
  },
];

export function BusinessKindForm({ initialValue }: { initialValue: string | null }) {
  const [value, setValue] = useState<Kind | null>(
    (ONBOARDING_BUSINESS_KINDS as readonly string[]).includes(initialValue ?? "")
      ? (initialValue as Kind)
      : null,
  );
  const { execute, isPending, result } = useAction(saveBusinessKindAction);

  // L'attente prend la place du formulaire, plutôt que de se réduire à un
  // libellé changé au bas de l'écran.
  if (isPending) return <StepPending title="Nous notons votre type de commerce" />;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value) execute({ businessKind: value });
      }}
    >
      <div role="radiogroup" aria-label="Type de commerce" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <KindTile
            key={option.value}
            option={option}
            checked={value === option.value}
            onSelect={() => setValue(option.value)}
          />
        ))}
      </div>

      {result.serverError && <p className="mt-4 text-sm text-danger">{result.serverError}</p>}

      <StepFooter disabled={!value} pending={isPending} />
    </form>
  );
}

/**
 * Une tuile de choix.
 *
 * Un vrai `<input type="radio">` est caché dessous plutôt que simulé en
 * JavaScript : on garde la navigation au clavier, les flèches qui passent d'une
 * option à l'autre, la lecture correcte par un lecteur d'écran et la soumission
 * native du formulaire. La tuile n'est que l'habillage.
 *
 * L'état sélectionné se lit à deux signaux — la bordure passe au noir et le
 * disque se remplit —, jamais à la couleur seule : la charte est en noir et
 * blanc, une nuance de gris ne suffirait pas à distinguer coché de survolé.
 */
function KindTile({
  option,
  checked,
  onSelect,
}: {
  option: (typeof OPTIONS)[number];
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`group relative flex cursor-pointer flex-col gap-3 rounded-[28px] border bg-snow p-5 transition-all duration-200 sm:p-6 ${
        checked
          ? "border-obsidian shadow-[var(--shadow-md)] ring-1 ring-obsidian"
          : "border-fog hover:border-pebble"
      }`}
    >
      <input
        type="radio"
        name="businessKind"
        value={option.value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />

      <span className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-200 ${
            checked ? "border-obsidian bg-obsidian text-white" : "border-fog bg-mist text-graphite"
          }`}
        >
          {option.icon}
        </span>

        {/* Le disque de sélection, dessiné plutôt qu'emprunté au navigateur :
            le contrôle natif ignore la charte et resterait bleu système. */}
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
            checked ? "border-obsidian" : "border-pebble group-hover:border-steel"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full bg-obsidian transition-transform duration-200 ${
              checked ? "scale-100" : "scale-0"
            }`}
          />
        </span>
      </span>

      <span>
        <span className="block text-base font-semibold leading-snug">{option.label}</span>
        <span className="mt-1.5 block text-sm leading-relaxed text-muted">
          {option.description}
        </span>
      </span>
    </label>
  );
}

function StoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 6.2 4.8 4h14.4l1.3 2.2a3 3 0 0 1-5.25 2.9 3 3 0 0 1-5.25 0 3 3 0 0 1-5.25-2.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
