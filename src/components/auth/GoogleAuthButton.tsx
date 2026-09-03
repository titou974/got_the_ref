"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GoogleMark } from "@/components/home/GoogleMark";
import { authClient } from "@/features/auth/client";

/**
 * Connexion Google en un geste.
 *
 * `signIn.social` renvoie le navigateur chez Google : au retour, Better Auth
 * dépose la session puis suit `callbackURL`. C'est le seul parcours d'auth qui
 * ne peut pas passer par une server action — la redirection doit partir du
 * navigateur.
 *
 * L'état occupé n'est jamais relâché en cas de succès : la page part chez
 * Google. On ne le remet à zéro que si l'appel échoue, pour laisser réessayer.
 */
export function GoogleAuthButton({
  mode,
  callbackURL,
  beforeRedirect,
  label,
}: {
  mode: "signin" | "signup";
  callbackURL: string;
  /**
   * Ce qu'il reste à faire côté serveur avant de quitter la page.
   *
   * L'analyse de la page d'accueil s'en sert pour mettre de côté le site que le
   * visiteur vient de donner : passé le départ chez Google, il n'y a plus de
   * page pour le porter. Renvoyer `false` annule le départ — l'appelant a
   * quelque chose à dire, et l'envoyer chez Google effacerait son message.
   */
  beforeRedirect?: () => Promise<boolean>;
  /** Libellé de remplacement, quand le contexte demande autre chose. */
  label?: string;
}) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    if (beforeRedirect && !(await beforeRedirect())) {
      setPending(false);
      return;
    }

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
        // Un échec côté Google ramène sur la page d'où l'on vient, avec le
        // message d'erreur en clair plutôt qu'un écran blanc. La query part
        // avec : sans elle, le retour perdrait la destination (`?suite=…`) et
        // ferait sortir le visiteur de son tunnel.
        errorCallbackURL: `${window.location.pathname}${window.location.search}`,
      });
    } catch {
      setError(t("googleError"));
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-pill border border-ember/25 bg-ember/10 px-6 py-4 text-base font-medium text-text transition-colors duration-200 hover:bg-ember/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark size={22} />
        {pending
          ? t("submitting")
          : (label ??
            (mode === "signup" ? t("googleSignup") : t("googleSignin")))}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
