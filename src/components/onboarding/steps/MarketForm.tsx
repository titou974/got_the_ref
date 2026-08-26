"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { CityTags, PillField } from "@/components/onboarding/Field";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { StepPending } from "@/components/onboarding/StepPending";
import { saveMarketAction } from "@/features/onboarding/actions";

/**
 * Étape 3 — le marché visé, et les villes pour un commerce qui reçoit du public.
 *
 * Les villes lues sur le site sont déjà posées : le client confirme ou corrige
 * plutôt que de tout retaper. Une adresse oubliée dans un pied de page est vite
 * prise pour une implantation, d'où la correction laissée ouverte.
 */
export function MarketForm({
  physical,
  initialMarket,
  initialCities,
  detectedCountry,
  detectedLanguage,
}: {
  physical: boolean;
  initialMarket: string | null;
  initialCities: string[];
  detectedCountry: string | null;
  detectedLanguage: string | null;
}) {
  const [market, setMarket] = useState(initialMarket ?? countryLabel(detectedCountry) ?? "");
  const [cities, setCities] = useState<string[]>(initialCities);
  const { execute, isPending, result } = useAction(saveMarketAction);

  const marketError = result.validationErrors?.targetMarket?._errors?.[0];

  if (isPending) return <StepPending title="Nous notons votre marché" />;

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        execute({ targetMarket: market, cities });
      }}
    >
      {(detectedCountry || detectedLanguage) && (
        <p className="rounded-[20px] border border-fog bg-snow px-5 py-4 text-sm text-muted">
          Sur votre site, nous avons lu
          {detectedLanguage ? ` du contenu en ${languageLabel(detectedLanguage)}` : ""}
          {detectedCountry ? `, orienté ${countryLabel(detectedCountry)}` : ""}. Corrigez si ce
          n&apos;est pas le marché que vous visez.
        </p>
      )}

      <PillField
        name="targetMarket"
        label="Marché visé"
        placeholder="France, Suisse romande, Europe francophone…"
        value={market}
        onChange={(event) => setMarket(event.target.value)}
        error={marketError}
      />

      {physical && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted">
            Villes de votre commerce {cities.length > 1 ? `(${cities.length})` : ""}
          </p>
          <CityTags
            cities={cities}
            onAdd={(city) =>
              setCities((current) => (current.includes(city) ? current : [...current, city]))
            }
            onRemove={(city) => setCities((current) => current.filter((item) => item !== city))}
          />
          <p className="mt-2 px-2 text-sm text-muted">
            Une ville par étiquette. Ajoutez chaque adresse où l&apos;on peut vous rendre visite.
          </p>
        </div>
      )}

      {result.serverError && <p className="text-sm text-danger">{result.serverError}</p>}

      <StepFooter disabled={market.trim().length < 2} pending={isPending} />
    </form>
  );
}

/** Rend lisible un code pays ISO renvoyé par l'analyse (« FR » → « la France »). */
function countryLabel(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function languageLabel(code: string): string {
  try {
    return new Intl.DisplayNames(["fr"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
