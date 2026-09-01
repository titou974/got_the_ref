"use client";

import { useEffect, useState } from "react";
import type { BusinessMode } from "@/lib/geo/types";

/**
 * Les questions du clavier d'attente, demandées au serveur pour un site donné.
 *
 * Les deux écrans d'attente du produit s'en servent — celui de l'analyse
 * gratuite lancée depuis l'accueil, et celui de la mise en route du tableau de
 * bord. Ils affichent le même clavier et posent la même question au serveur ;
 * la poser à deux endroits différents finirait par donner deux comportements
 * différents le jour où l'un des deux serait retouché.
 *
 * L'appel est délibérément non bloquant et sans état d'erreur : `undefined`
 * signifie « pas encore de réponse », et le clavier tape ses questions
 * d'attente pendant ce temps. Une panne de ce côté ne doit jamais se voir — ce
 * qui compte à l'écran, c'est l'analyse en cours, pas son décor.
 */
export function useNicheQuestions(
  url: string | null | undefined,
  mode: BusinessMode = "physical",
): { questions: string[] | undefined; niche: string | null } {
  const [questions, setQuestions] = useState<string[] | undefined>(undefined);
  const [niche, setNiche] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;

    fetch("/api/analyze/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, mode }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestions(data.questions as string[]);
        }
        if (typeof data.niche === "string" && data.niche) setNiche(data.niche);
      })
      .catch(() => {
        /* questions indisponibles : celles d'attente restent affichées */
      });

    return () => {
      alive = false;
    };
  }, [url, mode]);

  return { questions, niche };
}
