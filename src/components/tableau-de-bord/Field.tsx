"use client";

import { cx } from "@/lib/utils";

/**
 * Les champs de saisie du tableau de bord.
 *
 * Le bloc « settings » de Tremor s'appuie sur `TextInput`, `Select` et
 * `Textarea` de `@tremor/react`, qui réclament Tailwind 3 et son fichier de
 * configuration ; le projet est en Tailwind 4. La forme du bloc est donc reprise
 * — libellé au-dessus, aide en dessous, grille de six colonnes — avec les jetons
 * du site.
 *
 * Plus compacts que les champs pilule du tunnel d'accueil : celui-ci pose une
 * question par écran, un écran de réglages en pose une quinzaine.
 *
 * `text-base` sur mobile n'est pas un caprice : sous 16 px, iOS zoome à la mise
 * au point et casse la mise en page.
 */

const control =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-base text-text placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-obsidian/25 disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted sm:text-sm";

const border = (error?: string) =>
  error ? "border-danger" : "border-border focus:border-obsidian";

function Shell({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Shell name={name} label={label} error={error} hint={hint}>
      <input
        id={name}
        name={name}
        {...props}
        aria-invalid={error ? true : undefined}
        className={cx(control, border(error))}
      />
    </Shell>
  );
}

/**
 * Une couleur : la pipette du navigateur, et son code écrit à côté.
 *
 * Les deux, parce qu'aucun ne suffit seul. La pipette choisit une teinte sans
 * rien connaître de l'hexadécimal, mais elle ne se copie pas et ne se colle pas ;
 * le code, lui, se recopie depuis une charte graphique, ce que fera tout client
 * qui en a une. Ils écrivent la même valeur, chacun met l'autre à jour.
 *
 * Le champ texte accepte ce qu'on y tape, y compris un code inachevé : la
 * validation se fait à l'envoi (cf. `settingsSchema`), pas à la frappe, sans
 * quoi il serait impossible d'effacer une couleur pour en écrire une autre.
 */
export function ColorField({
  name,
  label,
  value,
  onChange,
  error,
  hint,
}: {
  name: string;
  label: string;
  /** `#1a2b3c`, ou la chaîne vide quand aucune couleur n'est posée. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <Shell name={name} label={label} error={error} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={label}
          // La pipette réclame une valeur valide : sans couleur posée, elle
          // s'ouvre sur le gris de l'interface plutôt que sur le noir par
          // défaut, qui se lirait comme une couleur choisie.
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#d4d4d8"}
          onChange={(event) => onChange(event.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-xl border border-border bg-surface p-1"
        />
        <input
          id={name}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#1a2b3c"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          className={cx(control, "font-mono tabular-nums", border(error))}
        />
      </div>
    </Shell>
  );
}

export function AreaField({
  name,
  label,
  error,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Shell name={name} label={label} error={error} hint={hint}>
      <textarea
        id={name}
        name={name}
        {...props}
        aria-invalid={error ? true : undefined}
        className={cx(control, "resize-y leading-relaxed", border(error))}
      />
    </Shell>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Shell name={name} label={label} error={error} hint={hint}>
      {/* Le chevron est dessiné à côté plutôt que laissé au navigateur : la
          flèche native change de forme d'un système à l'autre et ne suit pas la
          couleur du texte. `appearance-none` la retire, celui-ci la remplace. */}
      <div className="relative">
        <select
          id={name}
          name={name}
          {...props}
          aria-invalid={error ? true : undefined}
          className={cx(control, "cursor-pointer appearance-none pr-10", border(error))}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-steel"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Shell>
  );
}

/** Le trait qui sépare deux sections de réglages. */
export function Divider({ className = "" }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-border", className)} />;
}
