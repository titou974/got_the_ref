"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signInAction, signUpAction } from "@/features/auth/actions";
import { ROUTES } from "@/constants/routes";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
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
      signUp.execute({ email, password, name: String(fd.get("name") ?? "") });
    } else {
      signIn.execute({ email, password });
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
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="input"
          placeholder={isSignup ? t("passwordPlaceholderSignup") : t("passwordPlaceholderSignin")}
        />
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
        className="w-full cursor-pointer rounded-xl bg-cta py-3 font-semibold text-white transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {active.isPending
          ? t("submitting")
          : isSignup
            ? t("submitSignup")
            : t("submitSignin")}
      </button>

      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>
            {t("haveAccount")}{" "}
            <Link href={ROUTES.signIn} className="cursor-pointer text-accent hover:underline">
              {t("goSignin")}
            </Link>
          </>
        ) : (
          <>
            {t("noAccount")}{" "}
            <Link href={ROUTES.signUp} className="cursor-pointer text-accent hover:underline">
              {t("goSignup")}
            </Link>
          </>
        )}
      </p>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: rgba(255,255,255,0.03);
          padding: 0.7rem 0.9rem;
          color: var(--color-text);
          font-size: 0.95rem;
        }
        .input::placeholder { color: rgba(148,163,184,0.6); }
        .input:focus { outline: none; border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(34,211,238,0.15); }
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
