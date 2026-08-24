"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * Une zone de saisie qui prend exactement la hauteur de son texte.
 *
 * L'atelier d'article empile une dizaine de ces zones, une par bloc. Avec une
 * barre de défilement interne, chacune deviendrait une petite fenêtre et le
 * document cesserait de se lire d'un trait : ici, la page défile, pas les blocs.
 */
export function AutoTextarea({
  value,
  onValueChange,
  onRegister,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Donne la zone à l'appelant : la barre d'outils écrit dans la sélection. */
  onRegister?: (element: HTMLTextAreaElement | null) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Remise à zéro avant mesure : sans cela la hauteur ne redescend jamais quand
  // on efface du texte, `scrollHeight` restant bloqué sur le maximum atteint.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(element) => {
        ref.current = element;
        onRegister?.(element);
      }}
      value={value}
      rows={1}
      onChange={(event) => onValueChange(event.target.value)}
      {...rest}
    />
  );
}
