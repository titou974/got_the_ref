"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Ouvrir la modale de rattachement depuis ailleurs que sa barre.
 *
 * La modale vit dans la barre du bas (`SolveAgentsBar`), qui porte tout ce
 * qu'elle demande : le domaine, la plateforme détectée, les manques relevés, les
 * prochains articles, et de quoi rattacher le site sans quitter l'écran. Le
 * bandeau du haut de la page Articles veut ouvrir la même chose — c'est le même
 * geste, demandé à deux endroits d'une même page.
 *
 * Deux mauvaises façons de le faire. Renvoyer aux réglages : le client
 * traverse une page pour retrouver un formulaire qu'on lui affichait ici.
 * Monter une seconde modale dans le bandeau : il faudrait faire redescendre
 * toutes ces données une deuxième fois, et deux modales identiques finiraient
 * par diverger.
 *
 * Ce déclencheur ne transporte donc rien de la modale : il tient seulement le
 * fait qu'elle soit ouverte. La barre lit cet état et montre sa modale, avec ses
 * données à elle ; le bandeau se contente de le lever. Chacun garde ce qu'il
 * sait faire — le bandeau demande, la barre montre.
 */

type Trigger = {
  open: boolean;
  requestOpen: () => void;
  close: () => void;
};

const ConnectSiteContext = createContext<Trigger | null>(null);

export function ConnectSiteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const requestOpen = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, requestOpen, close }), [open, requestOpen, close]);

  return <ConnectSiteContext.Provider value={value}>{children}</ConnectSiteContext.Provider>;
}

/**
 * Le déclencheur, ou `null` hors du tableau de bord.
 *
 * Nul sur le rapport public, qui n'a ni coque ni barre : l'appelant retombe
 * alors sur son propre chemin — un lien vers les réglages, une modale à lui.
 */
export function useConnectSite(): Trigger | null {
  return useContext(ConnectSiteContext);
}
