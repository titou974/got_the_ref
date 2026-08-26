"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Les briques communes aux formulaires d'authentification : connexion,
 * inscription, mot de passe oublié, nouveau mot de passe. Elles vivaient dans
 * `AuthForm` ; les écrans de réinitialisation demandent exactement les mêmes
 * champs, et une pilule blanche de travers se verrait au premier coup d'œil.
 */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * Champ mot de passe avec bascule d'affichage. Sur un mot de passe qu'on vient
 * d'inventer, pouvoir le relire évite la faute de frappe qu'on ne découvrirait
 * qu'à la connexion suivante.
 */
export function PasswordField({
  label,
  name = "password",
  autoComplete,
  placeholder,
  minLength,
  error,
}: {
  label: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  error?: string;
}) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label}>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className="input pr-12"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("passwordHide") : t("passwordShow")}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-9 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-steel transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/30"
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>
      {error && (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Field>
  );
}

/** Le message d'échec, au-dessus du bouton d'envoi. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
      {message}
    </p>
  );
}

/** La pilule noire d'envoi, pleine largeur. */
export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full cursor-pointer rounded-pill bg-cta py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("submitting") : children}
    </button>
  );
}

/**
 * Le dessin des champs. Rendu dans le formulaire plutôt que dans la feuille
 * globale : la classe `.input` n'existe que là où ces champs sont montés.
 */
export function AuthFieldStyles() {
  return (
    <style>{`
      .input {
        width: 100%;
        border-radius: 10000px;
        border: 1px solid var(--color-border);
        background: var(--color-snow);
        padding: 0.85rem 1.15rem;
        color: var(--color-text);
        font-size: 0.95rem;
      }
      .input::placeholder { color: var(--color-ash); }
      .input:focus { outline: none; border-color: var(--color-obsidian); box-shadow: 0 0 0 3px rgba(9,9,11,0.12); }
    `}</style>
  );
}

/** Œil ouvert / barré, tracé inline — même trait que le reste des icônes. */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      {crossed && (
        <path
          d="M4 20 20 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
