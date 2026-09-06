"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthForm } from "@/components/AuthForm";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { afterAuthWithNext, ROUTES } from "@/constants/routes";

/**
 * Le panneau d'authentification : Google d'abord, l'e-mail ensuite.
 *
 * Deux temps volontaires. Au premier écran, un seul choix à faire — Google, ou
 * bien l'e-mail ; le formulaire ne s'ouvre qu'une fois ce choix posé. Trois
 * champs affichés d'emblée à côté d'un bouton Google feraient hésiter alors que
 * la plupart des visiteurs prendront Google.
 *
 * `googleEnabled` vient du serveur : sans identifiants OAuth configurés, le
 * bouton n'est pas rendu et le formulaire s'ouvre directement, plutôt que de
 * proposer un chemin qui échouerait au retour de Google.
 *
 * `error` porte l'échec renvoyé par Google dans l'URL. Sans lui, un retour
 * refusé ramenait sur un écran d'inscription identique à celui qu'on venait de
 * quitter, sans un mot d'explication.
 */
export function AuthPanel({
  mode,
  callbackURL,
  googleEnabled,
  switchHref,
  error = null,
  notice = null,
}: {
  mode: "signin" | "signup";
  /** Page à rejoindre une fois identifié. */
  callbackURL: string;
  googleEnabled: boolean;
  /** Bascule inscription ↔ connexion, destination conservée. */
  switchHref: string;
  /** Message d'échec du retour Google, déjà traduit. */
  error?: string | null;
  /** Confirmation à afficher en tête — mot de passe réinitialisé, par exemple. */
  notice?: string | null;
}) {
  const t = useTranslations("auth");
  const isSignup = mode === "signup";
  // Une confirmation en tête vient d'un mot de passe fraîchement changé : le
  // visiteur a un mot de passe en tête et une adresse, pas un compte Google à
  // choisir. On lui ouvre le formulaire plutôt que l'écran de choix.
  const [showEmailForm, setShowEmailForm] = useState(!googleEnabled || Boolean(notice));

  // Google ne distingue pas un nouveau venu d'un client qui a déjà un compte :
  // le même clic ouvre une session dans les deux cas, et il rend la main au
  // navigateur sans savoir à qui il a affaire. Les deux modes repassent donc
  // par `/bienvenue`, seul endroit où l'on sait qui vient d'entrer — sinon un
  // compte sans accueil rempli atterrit sur des écrans vides, et un abonné de
  // longue date sur la grille tarifaire.
  const googleCallbackURL = afterAuthWithNext(callbackURL);

  return (
    <div className="w-full">
      <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
        {isSignup ? t("signupTitle") : t("signinTitle")}
      </h1>

      <p className="mt-3 text-base text-muted">
        {isSignup ? t("haveAccount") : t("noAccount")}{" "}
        <Link
          href={switchHref}
          className="cursor-pointer font-semibold text-text underline underline-offset-4 transition-opacity duration-200 hover:opacity-70"
        >
          {isSignup ? t("goSignin") : t("goSignup")}
        </Link>
      </p>

      {notice && (
        <p className="mt-6 rounded-lg bg-success/10 px-3 py-2 text-sm text-text" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p
          className="mt-6 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {showEmailForm ? (
        <div className="mt-8">
          <AuthForm mode={mode} showAccountSwitch={false} next={callbackURL} />
          {googleEnabled && (
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="mt-4 w-full cursor-pointer text-center text-sm text-muted transition-colors duration-200 hover:text-text"
            >
              {t("otherOptions")}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <GoogleAuthButton mode={mode} callbackURL={googleCallbackURL} />

          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-fog" />
            <span className="text-sm text-muted">{t("or")}</span>
            <span className="h-px flex-1 bg-fog" />
          </div>

          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="w-full cursor-pointer rounded-pill bg-cta px-6 py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {isSignup ? t("emailSignup") : t("emailSignin")}
          </button>
        </div>
      )}

      {isSignup && (
        <p className="mt-7 text-sm leading-relaxed text-muted">
          {t("legalBefore")}{" "}
          <Link
            href={ROUTES.legal.terms}
            className="cursor-pointer underline underline-offset-4 transition-colors duration-200 hover:text-text"
          >
            {t("legalTerms")}
          </Link>{" "}
          {t("legalAnd")}{" "}
          <Link
            href={ROUTES.legal.privacy}
            className="cursor-pointer underline underline-offset-4 transition-colors duration-200 hover:text-text"
          >
            {t("legalPrivacy")}
          </Link>
          .
        </p>
      )}
    </div>
  );
}
