"use client";

import { useAction } from "next-safe-action/hooks";
import { GoogleMark } from "@/components/home/GoogleMark";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { completeOnboardingAction } from "@/features/onboarding/actions";

/** Ce que le retour de Google raconte, traduit pour le client. */
const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connecte: { tone: "ok", text: "Search Console est rattachée. Vos positions remonteront ici." },
  "aucune-propriete": {
    tone: "warn",
    text: "Aucune propriété n'est visible sur ce compte Google. Vérifiez que c'est bien celui qui gère votre site.",
  },
  refuse: { tone: "warn", text: "Autorisation refusée. Vous pourrez la donner plus tard." },
  "etat-invalide": { tone: "warn", text: "Le lien a expiré. Relancez la connexion." },
  indisponible: {
    tone: "warn",
    text: "La connexion Google n'est pas configurée sur cette installation.",
  },
  echec: { tone: "warn", text: "Google n'a pas répondu. Réessayez dans un instant." },
};

/**
 * Étape 7 — le rattachement Search Console.
 *
 * Facultatif, mais c'est celui qui décide de ce que nous pourrons prouver.
 * Sans lui, nous mesurons ce que les moteurs de réponse citent ; avec lui, nous
 * mesurons aussi ce que cela vous rapporte en visites. L'argument est dit tel
 * quel plutôt qu'enrobé — c'est ce qui fait accepter une demande d'accès.
 */
export function SearchConsoleStep({
  connected,
  siteUrl,
  status,
}: {
  connected: boolean;
  siteUrl: string | null;
  status?: string;
}) {
  const complete = useAction(completeOnboardingAction);
  const message = status ? MESSAGES[status] : undefined;

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

      {connected ? (
        <div className="rounded-[24px] border border-obsidian bg-snow p-6">
          <span
            aria-hidden
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-obsidian text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5 10 17.5 19 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-base font-semibold">Search Console est rattachée</p>
          <p className="mt-1 text-sm text-muted">
            {siteUrl ? `Propriété suivie : ${siteUrl}` : "Propriété en cours de sélection."}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {[
              "Vos positions avant et après nos passes, sur les mêmes requêtes.",
              "Les pages qui vous amènent des visites, et celles qui n'en amènent aucune.",
              "Un accès en lecture seule : nous ne publions rien et ne modifions rien.",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-obsidian" />
                {line}
              </li>
            ))}
          </ul>

          <a
            href="/api/gsc/connect"
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-pill border border-obsidian/20 bg-snow px-6 py-4 text-base font-medium transition-colors duration-200 hover:border-obsidian"
          >
            <GoogleMark size={18} />
            Connecter Google Search Console
          </a>
        </>
      )}

      {complete.result.serverError && (
        <p className="text-sm text-danger">{complete.result.serverError}</p>
      )}

      <StepFooter
        label={connected ? "Ouvrir mon tableau de bord" : "Terminer sans connecter"}
        pending={complete.isPending}
      />
    </form>
  );
}
