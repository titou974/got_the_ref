"use client";

import { useEffect, useState } from "react";
import { SearchLoader, type SearchKind } from "@/components/SearchLoader";

/**
 * Ce que devient une étape d'accueil pendant qu'elle s'enregistre : la carte
 * d'attente, à la place du formulaire.
 *
 * Le libellé du bouton ne porte pas l'attente. « Un instant… » sur une pilule
 * figée en bas d'écran, c'est le seul signe que quelque chose se passe, et il
 * est hors du champ de vision de quelqu'un qui vient de choisir en haut de page.
 * La carte prend la place du formulaire : le regard est déjà dessus.
 *
 * Le délai de grâce évite le clignotement. Enregistrer un choix prend parfois
 * cent millisecondes : afficher puis retirer une carte dans cet intervalle donne
 * un à-coup plus désagréable que l'attente elle-même.
 */
const GRACE_MS = 260;

export function StepPending({ kind = "saving", title }: { kind?: SearchKind; title: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return <SearchLoader kind={kind} title={title} />;
}
