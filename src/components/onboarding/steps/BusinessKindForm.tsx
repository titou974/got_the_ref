"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { RadioCards } from "@/components/onboarding/RadioCards";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { saveBusinessKindAction } from "@/features/onboarding/actions";

/**
 * Étape 1 — la forme du commerce.
 *
 * Cette réponse commande tout le reste du tunnel : elle décide si l'on
 * réclamera une fiche Google Maps, si l'on cherchera des villes dans le crawl,
 * et si les concurrents proposés doivent être ceux du quartier ou ceux du web.
 * D'où sa place en tête, avant même l'adresse du site.
 */
const OPTIONS = [
  {
    value: "physical",
    label: "Un commerce physique",
    description: "Boutique, artisan, restaurant, agence. Vos clients poussent la porte.",
    icon: <StoreIcon />,
  },
  {
    value: "online",
    label: "Un commerce en ligne",
    description: "Boutique en ligne, logiciel, service à distance. Aucune adresse à visiter.",
    icon: <GlobeIcon />,
  },
  {
    value: "both",
    label: "Les deux",
    description: "Une adresse où l'on vous trouve, et une vitrine qui vend au-delà.",
    icon: <BothIcon />,
  },
];

export function BusinessKindForm({ initialValue }: { initialValue: string | null }) {
  const [value, setValue] = useState<string | null>(initialValue);
  const { execute, isPending, result } = useAction(saveBusinessKindAction);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value) execute({ businessKind: value as "physical" | "online" | "both" });
      }}
    >
      <RadioCards name="businessKind" options={OPTIONS} value={value} onChange={setValue} />

      {result.serverError && <p className="mt-4 text-sm text-danger">{result.serverError}</p>}

      <StepFooter disabled={!value} pending={isPending} />
    </form>
  );
}

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BothIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="9" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
