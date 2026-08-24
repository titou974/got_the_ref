"use client";

/**
 * Les cartes à cocher du tunnel d'accueil.
 *
 * Un vrai `<input type="radio">` est caché sous chaque carte plutôt que simulé
 * en JavaScript : on garde la navigation au clavier, les flèches qui passent
 * d'une option à l'autre, la lecture correcte par un lecteur d'écran et la
 * soumission native du formulaire. La carte n'est que l'habillage.
 *
 * L'état sélectionné se lit à deux signaux — la bordure passe au noir et le
 * disque se remplit —, jamais à la couleur seule : la charte est en noir et
 * blanc, une nuance de gris ne suffirait pas à distinguer coché de survolé.
 */
export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
};

export function RadioCards({
  name,
  options,
  value,
  onChange,
  columns = 1,
}: {
  name: string;
  options: RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  columns?: 1 | 2;
}) {
  return (
    <div
      role="radiogroup"
      className={`grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}
    >
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={`group relative flex cursor-pointer items-start gap-4 rounded-[24px] border bg-snow p-5 transition-all duration-200 ${
              checked
                ? "border-obsidian shadow-[var(--shadow-md)] ring-1 ring-obsidian"
                : "border-fog hover:border-pebble"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />

            {/* Le disque de sélection, dessiné plutôt qu'emprunté au navigateur :
                le contrôle natif ignore la charte et resterait bleu système. */}
            <span
              aria-hidden
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                checked ? "border-obsidian" : "border-pebble group-hover:border-steel"
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full bg-obsidian transition-transform duration-200 ${
                  checked ? "scale-100" : "scale-0"
                }`}
              />
            </span>

            <span className="flex-1">
              <span className="flex items-center gap-2">
                {option.icon && (
                  <span aria-hidden className="text-muted">
                    {option.icon}
                  </span>
                )}
                <span className="text-base font-semibold leading-snug">{option.label}</span>
              </span>
              {option.description && (
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * La même carte, en case à cocher : plusieurs réponses possibles.
 * Le carré arrondi au lieu du disque suffit à annoncer la différence — c'est la
 * convention que tout le monde lit sans y penser.
 */
export function CheckCards({
  name,
  options,
  values,
  onToggle,
}: {
  name: string;
  options: RadioOption[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <label
            key={option.value}
            className={`group flex cursor-pointer items-start gap-4 rounded-[24px] border bg-snow p-5 transition-all duration-200 ${
              checked
                ? "border-obsidian shadow-[var(--shadow-md)] ring-1 ring-obsidian"
                : "border-fog hover:border-pebble"
            }`}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onToggle(option.value)}
              className="sr-only"
            />

            <span
              aria-hidden
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border-2 transition-colors duration-200 ${
                checked
                  ? "border-obsidian bg-obsidian text-white"
                  : "border-pebble group-hover:border-steel"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className={`transition-transform duration-200 ${checked ? "scale-100" : "scale-0"}`}
              >
                <path
                  d="M5 12.5 10 17.5 19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span className="flex-1">
              <span className="block text-base font-semibold leading-snug">{option.label}</span>
              {option.description && (
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
