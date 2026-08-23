"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_BILLING_CYCLE, type BillingCycle } from "@/constants/plans";

/**
 * Le cycle choisi sur les onglets de la carte tarif, partagé avec le bouton de
 * paiement.
 *
 * Passer par un contexte plutôt que par une prop : la carte reçoit son CTA déjà
 * rendu depuis des composants serveur (page tarifs, bas de home), qui ne peuvent
 * pas lui transmettre de fonction. Le bouton, lui, est client — il vient donc
 * chercher le cycle ici, au moment du clic.
 */
const BillingCycleContext = createContext<BillingCycle>(DEFAULT_BILLING_CYCLE);

export function BillingCycleProvider({
  cycle,
  children,
}: {
  cycle: BillingCycle;
  children: ReactNode;
}) {
  return <BillingCycleContext.Provider value={cycle}>{children}</BillingCycleContext.Provider>;
}

/** Cycle courant — mensuel hors de la carte tarif (bouton isolé, ancien lien). */
export function useBillingCycle(): BillingCycle {
  return useContext(BillingCycleContext);
}
