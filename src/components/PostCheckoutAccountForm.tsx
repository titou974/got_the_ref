"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createAccountAfterCheckoutAction } from "@/features/auth/actions";

/**
 * Création de compte après paiement : l'e-mail provient de la session Stripe et
 * n'est pas modifiable — l'utilisateur ne choisit que son mot de passe.
 */
export function PostCheckoutAccountForm({
  sessionId,
  email,
}: {
  sessionId: string;
  email: string;
}) {
  const t = useTranslations("postCheckout");
  const ta = useTranslations("auth");
  const { execute, isPending, result } = useAction(createAccountAfterCheckoutAction);

  const rootError = result.validationErrors?._errors?.[0];
  const passwordError = result.validationErrors?.password?._errors?.[0];
  const serverError = result.serverError;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    execute({
      sessionId,
      password: String(fd.get("password") ?? ""),
      name: String(fd.get("name") ?? ""),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{ta("emailLabel")}</span>
        <input
          type="email"
          value={email}
          readOnly
          disabled
          className="w-full rounded-[14px] border border-fog bg-mist px-3.5 py-2.5 text-[0.95rem] text-muted"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{ta("nameLabel")}</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          placeholder={ta("namePlaceholder")}
          className="w-full rounded-[14px] border border-fog bg-snow px-3.5 py-2.5 text-[0.95rem] text-text placeholder:text-ash focus:border-obsidian focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{ta("passwordLabel")}</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={ta("passwordPlaceholderSignup")}
          className="w-full rounded-[14px] border border-fog bg-snow px-3.5 py-2.5 text-[0.95rem] text-text placeholder:text-ash focus:border-obsidian focus:outline-none"
        />
        {passwordError && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {passwordError}
          </p>
        )}
      </label>

      {(rootError || serverError) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {rootError ?? serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full cursor-pointer rounded-full bg-cta py-3 font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? ta("submitting") : t("createAccount")}
      </button>
    </form>
  );
}
