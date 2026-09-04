"use client";

import { useEffect } from "react";

/**
 * Atterrissage sur `/#analyser` (souvent via l'alias `/analyse-gratuite`).
 *
 * Le navigateur cale bien la page sur l'ancre au chargement, mais il le fait
 * une fois, tôt : au-dessus du formulaire vivent un hero animé, un bandeau de
 * secteurs et un carrousel dont la hauteur se fixe après coup. Le repère se
 * décale alors sous les yeux du visiteur, qui arrive à côté du champ.
 *
 * On recale donc quelques fois pendant la mise en place, sans jamais contrarier
 * quelqu'un : au premier geste de défilement — molette, doigt, clavier — on
 * lâche prise définitivement.
 */
export function AuditAnchorLanding({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${targetId}`) return;

    let active = true;
    const align = () => {
      if (!active) return;
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    };
    const release = () => {
      active = false;
    };

    const frame = requestAnimationFrame(align);
    const settle = window.setTimeout(align, 400);
    window.addEventListener("load", align);
    // `wheel` et `touchstart` en capture : le geste doit nous arrêter même si un
    // composant intermédiaire l'absorbe.
    const options = { capture: true, passive: true } as const;
    window.addEventListener("wheel", release, options);
    window.addEventListener("touchstart", release, options);
    window.addEventListener("keydown", release, { capture: true });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("load", align);
      window.removeEventListener("wheel", release, options);
      window.removeEventListener("touchstart", release, options);
      window.removeEventListener("keydown", release, { capture: true });
    };
  }, [targetId]);

  return null;
}
