"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signInAction, signUpAction } from "@/features/auth/actions";
import { ROUTES } from "@/constants/routes";

/**
 * Formulaire e-mail + mot de passe.
 *
 * `showAccountSwitch` existe parce que le panneau d'authentification affiche
 * désormais « Vous avez déjà un compte ? » tout en haut, au-dessus des boutons :
 * le répéter sous le formulaire ferait doublon.
 */
export function AuthForm({
  mode,
  showAccountSwitch = true,
  next,
}: {
  mode: "signin" | "signup";
  showAccountSwitch?: boolean;
  /** Page à rejoindre une fois identifié (filtrée côté serveur). */
  next?: string;
}) {
  const t = useTranslations("auth");
  const isSignup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);

  const signUp = useAction(signUpAction);
  const signIn = useAction(signInAction);
  const active = isSignup ? signUp : signIn;

  const rootError = active.result.validationErrors?._errors?.[0];
  const emailError = active.result.validationErrors?.email?._errors?.[0];
  const passwordError = active.result.validationErrors?.password?._errors?.[0];
  const serverError = active.result.serverError;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    if (isSignup) {
      signUp.execute({ email, password, name: String(fd.get("name") ?? ""), next });
    } else {
      signIn.execute({ email, password, next });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSignup && (
        <Field label={t("nameLabel")}>
          <input
            name="name"
            type="text"
            autoComplete="name"
            className="input"
            placeholder={t("namePlaceholder")}
          />
        </Field>
      )}
      <Field label={t("emailLabel")}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder={t("emailPlaceholder")}
        />
        {emailError && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {emailError}
          </p>
        )}
      </Field>
      <Field label={t("passwordLabel")}>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="input pr-12"
            placeholder={
              isSignup ? t("passwordPlaceholderSignup") : t("passwordPlaceholderSignin")
            }
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("passwordHide") : t("passwordShow")}
            aria-pressed={showPassword}
            className="absolute right-1 top-1/2 flex h-9 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-steel transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/30"
          >
            <EyeIcon crossed={showPassword} />
          </button>
        </div>
        {passwordError && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {passwordError}
          </p>
        )}
      </Field>

      {(rootError || serverError) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {rootError ?? serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={active.isPending}
        className="w-full cursor-pointer rounded-pill bg-cta py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {active.isPending
          ? t("submitting")
          : isSignup
            ? t("submitSignup")
            : t("submitSignin")}
      </button>

      {showAccountSwitch && (
        <p className="text-center text-sm text-muted">
          {isSignup ? (
            <>
              {t("haveAccount")}{" "}
              <Link
                href={ROUTES.signIn}
                className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              >
                {t("goSignin")}
              </Link>
            </>
          ) : (
            <>
              {t("noAccount")}{" "}
              <Link
                href={ROUTES.signUp}
                className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              >
                {t("goSignup")}
              </Link>
            </>
          )}
        </p>
      )}

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
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
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
