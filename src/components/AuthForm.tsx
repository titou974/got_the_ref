"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  AuthFieldStyles,
  Field,
  FormError,
  PasswordField,
  SubmitButton,
} from "@/components/auth/fields";
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
      <PasswordField
        label={t("passwordLabel")}
        autoComplete={isSignup ? "new-password" : "current-password"}
        minLength={8}
        placeholder={
          isSignup ? t("passwordPlaceholderSignup") : t("passwordPlaceholderSignin")
        }
        error={passwordError}
      />

      {/* Le lien de réinitialisation n'a de sens qu'à la connexion : à
          l'inscription, il n'y a pas encore de mot de passe à retrouver. */}
      {!isSignup && (
        <p className="-mt-1 text-right text-sm">
          <Link
            href={ROUTES.forgotPassword}
            className="cursor-pointer text-muted underline decoration-pebble underline-offset-4 hover:text-text hover:decoration-obsidian"
          >
            {t("forgotPassword")}
          </Link>
        </p>
      )}

      <FormError message={rootError ?? serverError} />

      <SubmitButton pending={active.isPending}>
        {isSignup ? t("submitSignup") : t("submitSignin")}
      </SubmitButton>

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

      <AuthFieldStyles />
    </form>
  );
}
