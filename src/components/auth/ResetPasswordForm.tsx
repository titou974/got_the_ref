"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  AuthFieldStyles,
  FormError,
  PasswordField,
  SubmitButton,
} from "@/components/auth/fields";
import { resetPasswordAction } from "@/features/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";
import { ROUTES } from "@/constants/routes";

/**
 * Choix du nouveau mot de passe, au bout du lien reçu par e-mail.
 *
 * Le jeton n'est pas saisi : il vient de l'URL et voyage dans un champ caché.
 * Un jeton expiré ou déjà consommé ne se distingue pas ici d'un jeton
 * inventé — Better Auth tranche, et l'échec renvoie vers une nouvelle demande.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const { execute, result, isPending } = useAction(resetPasswordAction);

  const rootError = result.validationErrors?._errors?.[0];
  const passwordError = result.validationErrors?.password?._errors?.[0];
  const tokenError = result.validationErrors?.token?._errors?.[0];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const password = String(new FormData(e.currentTarget).get("password") ?? "");
        execute({ token, password });
      }}
      className="space-y-4"
    >
      <PasswordField
        label={t("newPasswordLabel")}
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        placeholder={t("passwordPlaceholderSignup")}
        error={passwordError}
      />

      <FormError message={rootError ?? tokenError ?? result.serverError} />

      <SubmitButton pending={isPending}>{t("resetSubmit")}</SubmitButton>

      <p className="text-center text-sm text-muted">
        <Link
          href={ROUTES.forgotPassword}
          className="cursor-pointer underline decoration-pebble underline-offset-4 hover:text-text hover:decoration-obsidian"
        >
          {t("resetAskAgain")}
        </Link>
      </p>

      <AuthFieldStyles />
    </form>
  );
}
