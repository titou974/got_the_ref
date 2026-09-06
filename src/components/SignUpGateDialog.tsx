"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { AuthFieldStyles } from "@/components/auth/fields";
import {
  rememberFreeDemoAction,
  startFreeDemoAction,
} from "@/features/analysis/actions";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";
import { ROUTES } from "@/constants/routes";
import { lockScroll } from "@/lib/scroll-lock";

/**
 * L'inscription qui ouvre l'analyse gratuite, posée par-dessus la page
 * d'accueil.
 *
 * Elle a remplacé la modale qui ne demandait qu'une adresse. Ce parcours-là
 * ouvrait un compte sans mot de passe : la session ne vivait que dans le
 * navigateur qui l'avait créée, et il fallait un lien « mot de passe oublié »
 * dans l'e-mail de confirmation pour rentrer chez soi depuis un autre appareil.
 * C'était un détour pour un geste que le visiteur sait faire — choisir un mot
 * de passe — et un e-mail de plus à relever avant de voir quoi que ce soit.
 *
 * Google passe en premier, comme sur les écrans d'identification du site : sur
 * un téléphone, c'est un geste contre une adresse et un mot de passe à taper au
 * pouce. Le formulaire e-mail reste dessous, ouvert — il ne se mérite pas
 * derrière un second clic, la moitié des commerçants n'ont pas de compte Google
 * qu'ils veulent lier à leur activité.
 *
 * ## Le détour par Google
 *
 * Le départ chez Google quitte la page, et avec elle l'adresse du site que le
 * visiteur vient de taper. Elle est donc mise de côté côté serveur avant le
 * départ (`rememberFreeDemoAction`), et reprise au retour sur `/bienvenue`. Si
 * cette mise de côté échoue — adresse illisible, plafond atteint —, on ne part
 * pas : le message a plus de valeur que le voyage.
 */
export function SignUpGateDialog({
  site,
  defaultEmail = "",
  signInHref,
  googleEnabled = true,
  onEmailKept,
  onClose,
}: {
  /** Ce que le visiteur vient de saisir dans le formulaire d'analyse. */
  site: { url: string; mode: "physical" | "online"; mapsUrl: string | null };
  defaultEmail?: string;
  /** Où envoyer quelqu'un qui a déjà un compte. */
  signInHref: string;
  /** Faux quand les identifiants OAuth ne sont pas configurés. */
  googleEnabled?: boolean;
  /** L'adresse retenue pour la prochaine visite, une fois le compte ouvert. */
  onEmailKept: (email: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("analyzeForm");
  const ta = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  const signUp = useAction(startFreeDemoAction);
  const remember = useAction(rememberFreeDemoAction);

  const emailError = signUp.result.validationErrors?.email?._errors?.[0];
  const passwordError = signUp.result.validationErrors?.password?._errors?.[0];
  const rootError =
    signUp.result.validationErrors?._errors?.[0] ??
    signUp.result.validationErrors?.url?._errors?.[0] ??
    signUp.result.validationErrors?.mapsUrl?._errors?.[0] ??
    signUp.result.serverError ??
    remember.result.validationErrors?._errors?.[0] ??
    remember.result.validationErrors?.url?._errors?.[0] ??
    remember.result.validationErrors?.mapsUrl?._errors?.[0] ??
    remember.result.serverError;

  // Le compte est ouvert : la session est posée, on part sur le tableau de
  // bord, où l'écran d'attente lance l'analyse.
  useEffect(() => {
    const destination = signUp.result.data?.redirect;
    if (destination) router.push(destination);
  }, [signUp.result.data?.redirect, router]);

  // Échap ferme la modale ; verrou du scroll tant qu'elle est ouverte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const release = lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [onClose]);

  // La navigation qui suit l'inscription n'est pas instantanée : sans ce
  // maintien, le bouton reprendrait son libellé normal pendant que la page
  // change, ce qui se lit comme un échec.
  const pending = signUp.isPending || Boolean(signUp.result.data?.redirect);

  function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    onEmailKept(address);
    signUp.execute({ ...site, email: address, password });
  }

  /** Met le site de côté avant le départ chez Google ; `false` annule le voyage. */
  async function keepSiteForGoogle(): Promise<boolean> {
    const result = await remember.executeAsync(site);
    return Boolean(result?.data?.callbackURL);
  }

  return (
    <motion.div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto px-5 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* `cursor-pointer` n'est pas décoratif : iOS Safari ne dispatche pas de
          `click` sur un élément non interactif qui n'a pas ce curseur, et le
          « appuyer à côté pour fermer » resterait mort sur iPhone. */}
      <div
        className="absolute inset-0 cursor-pointer bg-obsidian/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-gate-title"
        className="relative my-auto w-full max-w-sm rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-7"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("emailClose")}
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-mist hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <h2 id="signup-gate-title" className="pr-8 text-lg font-bold text-text sm:text-xl">
          {t("signUpTitle")}
        </h2>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
          {t("signUpBody")}
        </p>

        {/* Google d'abord : un geste plutôt que deux champs. */}
        {googleEnabled && (
          <>
            <div className="mt-5">
              <GoogleAuthButton
                mode="signup"
                callbackURL={ROUTES.afterAuth}
                beforeRedirect={keepSiteForGoogle}
                label={t("signUpGoogle")}
              />
            </div>

            <div className="mt-5 flex items-center gap-4">
              <span className="h-px flex-1 bg-fog" />
              <span className="text-sm text-muted">{ta("or")}</span>
              <span className="h-px flex-1 bg-fog" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              {t("emailLabel")}
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              aria-invalid={Boolean(emailError)}
              className="input"
            />
          </label>
          {emailError && (
            <p className="text-xs text-danger" role="alert">
              {emailError}
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              {t("passwordLabel")}
            </span>
            <div className="relative">
              <input
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                aria-invalid={Boolean(passwordError)}
                className="input pr-12"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? ta("passwordHide") : ta("passwordShow")}
                className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-muted transition-colors duration-200 hover:text-text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  {visible ? (
                    <path
                      d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.4 5.3A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.6 2.1-1.6 3.2M6.3 6.8C4 8.3 3 10.5 3 12c0 2.5 4 7 9 7 1.4 0 2.7-.3 3.8-.9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <path
                        d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </label>
          {passwordError && (
            <p className="text-xs text-danger" role="alert">
              {passwordError}
            </p>
          )}

          {rootError && (
            <p className="text-xs text-danger" role="alert">
              {rootError}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {pending ? ta("submitting") : t("emailSubmit")}
          </button>

          {/* La pilule des champs d'identification, empruntée telle quelle :
              cette modale est un écran d'inscription, elle doit en avoir la
              main. */}
          <AuthFieldStyles />
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {t("haveAccount")}{" "}
          <Link
            href={signInHref}
            className="cursor-pointer underline decoration-pebble underline-offset-4 hover:text-text hover:decoration-obsidian"
          >
            {ta("submitSignin")}
          </Link>
        </p>

        <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-muted/80">
          {t("emailNote")}
        </p>
      </motion.div>
    </motion.div>
  );
}
