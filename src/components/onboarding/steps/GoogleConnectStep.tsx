"use client";

import { useAction } from "next-safe-action/hooks";
import { GoogleMark } from "@/components/home/GoogleMark";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { StepPending } from "@/components/onboarding/StepPending";
import { completeOnboardingAction } from "@/features/onboarding/actions";

/** Ce que le retour de Google raconte, traduit pour le client. */
const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connecte: { tone: "ok", text: "Les deux accès sont en place. Vos chiffres remonteront ici." },
  partiel: {
    tone: "warn",
    text: "Une partie seulement a été rattachée. Le détail est juste en dessous.",
  },
  refuse: { tone: "warn", text: "Autorisation refusée. Vous pourrez la donner plus tard." },
  "etat-invalide": { tone: "warn", text: "Le lien a expiré. Relancez la connexion." },
  indisponible: {
    tone: "warn",
    text: "La connexion Google n'est pas configurée sur cette installation.",
  },
  echec: { tone: "warn", text: "Google n'a pas répondu. Réessayez dans un instant." },
};

export type GoogleConnectionState = {
  gscConnected: boolean;
  gscSiteUrl: string | null;
  ga4Connected: boolean;
  ga4PropertyName: string | null;
};

/**
 * Étape 7 — le rattachement Google, Search Console et Analytics en un geste.
 *
 * Facultatif, mais c'est celui qui décide de ce que nous pourrons prouver. Sans
 * lui, nous mesurons ce que les moteurs de réponse citent ; avec lui, nous
 * mesurons aussi ce que cela rapporte en visites. L'argument est dit tel quel
 * plutôt qu'enrobé — c'est ce qui fait accepter une demande d'accès.
 *
 * Un seul bouton pour les deux services : Google sait les demander dans un même
 * écran, et deux allers-retours à la dernière étape du tunnel feraient deux
 * occasions d'abandonner. La carte dit d'entrée pourquoi il en faut deux, parce
 * qu'une demande d'accès qu'on ne comprend pas est une demande qu'on refuse.
 *
 * Le client garde la main : l'écran de consentement Google présente une case par
 * service, et n'en accorder qu'une est un cas normal, affiché comme tel.
 */
export function GoogleConnectStep({
  gscConnected,
  gscSiteUrl,
  ga4Connected,
  ga4PropertyName,
  status,
}: GoogleConnectionState & { status?: string }) {
  const complete = useAction(completeOnboardingAction);
  const message = status ? MESSAGES[status] : undefined;

  const both = gscConnected && ga4Connected;
  const some = gscConnected || ga4Connected;

  if (complete.isPending) {
    return <StepPending kind="audit" title="Nous ouvrons votre tableau de bord" />;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        complete.execute({});
      }}
    >
      {message && (
        <p
          className={`rounded-[20px] border px-5 py-4 text-sm ${
            message.tone === "ok"
              ? "border-obsidian bg-snow text-text"
              : "border-fog bg-snow text-muted"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="rounded-[24px] border border-obsidian bg-snow p-6">
        <p className="text-base font-semibold">Il nous faut les deux</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Ils ne mesurent pas la même chose. Search Console dit ce que les moteurs montrent de
          vous ; Analytics dit ce que cela devient une fois le clic passé — et c&apos;est le seul à
          voir arriver les visites depuis ChatGPT ou Perplexity.
        </p>

        <div className="mt-5 space-y-4 border-t border-fog pt-5">
          <ServiceRow
            name="Search Console"
            summary="Vos positions et vos requêtes, avant et après nos passes."
            connected={gscConnected}
            detail={gscSiteUrl}
          />
          <ServiceRow
            name="Analytics 4"
            summary="Les visites que cela vous amène, et par quel moteur elles arrivent."
            connected={ga4Connected}
            detail={ga4PropertyName}
          />
        </div>

        <p className="mt-5 border-t border-fog pt-5 text-xs leading-relaxed text-muted">
          Un seul écran Google pour les deux, en lecture seule : nous ne publions rien et ne
          modifions rien.
        </p>
      </div>

      {!both && (
        <a
          href="/api/google/connect"
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-pill border border-obsidian/20 bg-snow px-6 py-4 text-base font-medium transition-colors duration-200 hover:border-obsidian"
        >
          <GoogleMark size={18} />
          {some ? "Compléter la connexion Google" : "Connecter Google"}
        </a>
      )}

      {complete.result.serverError && (
        <p className="text-sm text-danger">{complete.result.serverError}</p>
      )}

      <StepFooter
        label={some ? "Ouvrir mon tableau de bord" : "Terminer sans connecter"}
        pending={complete.isPending}
      />
    </form>
  );
}

/**
 * Une ligne par service : ce qu'il apporte, et ce qui a été retenu pour vous.
 *
 * Le service non rattaché reste affiché plutôt que masqué — c'est ce qui rend
 * lisible un consentement partiel, où l'un est en place et l'autre pas.
 */
function ServiceRow({
  name,
  summary,
  connected,
  detail,
}: {
  name: string;
  summary: string;
  connected: boolean;
  detail: string | null;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          connected ? "bg-obsidian text-white" : "border border-fog text-muted"
        }`}
      >
        {connected ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-ash" />
        )}
      </span>

      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{summary}</p>
        {connected && (
          <p className="mt-1 truncate text-xs text-muted">
            {detail ? `Suivi : ${detail}` : "Propriété en cours de sélection."}
          </p>
        )}
      </div>
    </div>
  );
}
