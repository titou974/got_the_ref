"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  AuthFieldStyles,
  Field,
  FormError,
  SubmitButton,
} from "@/components/auth/fields";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { ROUTES } from "@/constants/routes";

/**
 * Demande d'un lien de réinitialisation.
 *
 * Une fois l'adresse envoyée, le formulaire cède la place à une confirmation :
 * il n'y a plus rien à saisir, et laisser le champ ouvert invite à recliquer
 * sur « Envoyer » en croyant que rien n'est parti.
 *
 * La confirmation ne dit pas si l'adresse existait — la réponse du serveur ne
 * le dit pas non plus. Elle est volontairement formulée au conditionnel :
 * « si un compte existe ».
 */
export function ForgotPasswordForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const t = useTranslations("auth");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const { execute, result, isPending } = useAction(requestPasswordResetAction);

  const rootError = result.validationErrors?._errors?.[0];
  const emailError = result.validationErrors?.email?._errors?.[0];
  const sent = result.data?.sent === true;

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-fog bg-mist p-4 text-sm leading-6 text-text">
          {t.rich("forgotSentBody", {
            email: submittedEmail,
            strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
          })}
        </div>
        <p className="text-sm text-muted">{t("forgotSentHint")}</p>
        <Link
          href={ROUTES.signIn}
          className="block cursor-pointer text-center text-sm text-muted underline decoration-pebble underline-offset-4 hover:text-text hover:decoration-obsidian"
        >
          {t("backToSignin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        setSubmittedEmail(email);
        execute({ email });
      }}
      className="space-y-4"
    >
      <Field label={t("emailLabel")}>
        <input
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          defaultValue={defaultEmail}
          className="input"
          placeholder={t("emailPlaceholder")}
        />
        {emailError && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {emailError}
          </p>
        )}
      </Field>

      <FormError message={rootError ?? result.serverError} />

      <SubmitButton pending={isPending}>{t("forgotSubmit")}</SubmitButton>

      <p className="text-center text-sm text-muted">
        <Link
          href={ROUTES.signIn}
          className="cursor-pointer underline decoration-pebble underline-offset-4 hover:text-text hover:decoration-obsidian"
        >
          {t("backToSignin")}
        </Link>
      </p>

      <AuthFieldStyles />
    </form>
  );
}
