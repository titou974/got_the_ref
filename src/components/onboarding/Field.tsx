"use client";

/**
 * Les champs de saisie du tunnel.
 *
 * Le champ pilule reprend la forme des boutons de la charte : sur ces écrans il
 * n'y a qu'une chose à faire, et le champ doit se voir de loin — d'où la
 * hauteur, la bordure pleine et le texte à taille de lecture. Rien de décoratif :
 * un champ discret sur un écran presque vide se cherche.
 *
 * `text-base` sur mobile n'est pas un caprice : sous 16 px, iOS zoome à la mise
 * au point et casse la mise en page.
 */
export function PillField({
  name,
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={name} className="mb-2 block text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        {...props}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-pill border bg-snow px-6 py-4 text-base text-text placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-obsidian/30 ${
          error ? "border-danger" : "border-obsidian/25 focus:border-obsidian"
        }`}
      />
      {error ? (
        <p className="mt-2 px-2 text-sm text-danger">{error}</p>
      ) : (
        hint && <p className="mt-2 px-2 text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Même logique pour un texte long : bords adoucis plutôt que pilule. */
export function AreaField({
  name,
  label,
  error,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  name: string;
  label?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={name} className="mb-2 block text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        {...props}
        aria-invalid={error ? true : undefined}
        className={`w-full resize-y rounded-[24px] border bg-snow px-5 py-4 text-base leading-relaxed text-text placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-obsidian/30 ${
          error ? "border-danger" : "border-obsidian/25 focus:border-obsidian"
        }`}
      />
      {error ? (
        <p className="mt-2 px-2 text-sm text-danger">{error}</p>
      ) : (
        hint && <p className="mt-2 px-2 text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

/**
 * Les villes, saisies comme des étiquettes.
 *
 * Un commerce à trois adresses ne rentre pas dans un champ unique sans qu'on
 * ait à deviner comment il les a séparées — virgule, tiret, retour à la ligne.
 * Une étiquette par ville lève l'ambiguïté et se corrige au coup par coup.
 */
export function CityTags({
  cities,
  onAdd,
  onRemove,
  placeholder = "Ajouter une ville",
}: {
  cities: string[];
  onAdd: (city: string) => void;
  onRemove: (city: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {cities.map((city) => (
          <span
            key={city}
            className="inline-flex items-center gap-2 rounded-pill border border-obsidian/20 bg-snow py-2 pl-4 pr-2 text-sm font-medium"
          >
            {city}
            <button
              type="button"
              onClick={() => onRemove(city)}
              aria-label={`Retirer ${city}`}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-mist hover:text-text"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
      </div>

      <input
        type="text"
        placeholder={placeholder}
        // Entrée ajoute la ville sans envoyer le formulaire : sur cette étape,
        // la touche Entrée sert à enchaîner les villes, pas à valider trop tôt.
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== ",") return;
          event.preventDefault();
          const input = event.currentTarget;
          const value = input.value.trim();
          if (value) onAdd(value);
          input.value = "";
        }}
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          if (value) onAdd(value);
          event.currentTarget.value = "";
        }}
        className={`w-full rounded-pill border border-obsidian/25 bg-snow px-6 py-4 text-base text-text placeholder:text-ash focus:border-obsidian focus:outline-none focus:ring-2 focus:ring-obsidian/30 ${
          cities.length > 0 ? "mt-3" : ""
        }`}
      />
    </div>
  );
}
