"use client";

/**
 * La barre d'action, collée en bas de l'écran.
 *
 * Fixe et non poussée par le contenu : sur un téléphone, l'étape « décrivez
 * votre activité » dépasse la hauteur du pouce, et un bouton en fin de page
 * obligerait à faire défiler pour valider trois lignes déjà écrites.
 *
 * Le bouton est désactivé tant que la réponse manque, plutôt que masqué : voir
 * la marche suivante grisée dit ce qu'il reste à faire, la faire disparaître ne
 * dit rien du tout.
 */
export function StepFooter({
  label = "Continuer",
  pendingLabel = "Un instant…",
  disabled = false,
  pending = false,
  onSkip,
  skipLabel = "Passer cette étape",
  hint,
}: {
  label?: string;
  pendingLabel?: string;
  disabled?: boolean;
  pending?: boolean;
  /** Rendu seulement sur les étapes facultatives. */
  onSkip?: () => void;
  skipLabel?: string;
  hint?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-fog bg-snow/95 backdrop-blur">
      <div className="mx-auto w-full max-w-lg px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {hint && <p className="mb-3 text-center text-xs text-muted">{hint}</p>}

        <button
          type="submit"
          disabled={disabled || pending}
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-pill bg-cta px-6 py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-ash disabled:shadow-none"
        >
          {pending ? pendingLabel : label}
          {!pending && (
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
              <path
                d="M1 7h17m0 0-5.5-5.5M18 7l-5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={pending}
            className="mt-3 w-full cursor-pointer text-center text-sm text-muted transition-colors duration-200 hover:text-text disabled:cursor-not-allowed"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
