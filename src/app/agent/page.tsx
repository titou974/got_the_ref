import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAccess } from "@/features/billing/access";
import { getDashboardContext } from "@/features/dashboard/queries";
import { findPendingByUserCode, normalizeUserCode } from "@/features/mcp/device";
import { AgentConsent } from "@/components/agent/AgentConsent";
import { AgentCodeForm } from "@/components/agent/AgentCodeForm";
import { Logo } from "@/components/Logo";
import { ROUTES, signInWithNext } from "@/constants/routes";

/**
 * L'écran d'appairage d'un agent IA.
 *
 * C'est la seule page du produit dont le rôle est de donner un accès. Elle
 * ressemble donc à ce qu'elle est — une carte seule sur la toile, sans barre de
 * navigation ni pied de page : rien à cliquer que le choix qu'on vient faire.
 *
 * Le compte doit être identifié : c'est la session du navigateur, et elle
 * seule, qui décide à quel compte l'agent sera rattaché. Un visiteur non
 * identifié repart par la connexion, code en poche.
 */
export const metadata: Metadata = {
  title: "Connecter un agent",
  robots: { index: false, follow: false },
};

const OFFER_LABELS = {
  free: "Compte gratuit",
  boost: "Coup de Boost",
  allin: "Abonnement Tout-en-un",
  demo: "Compte de démonstration",
} as const;

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).code;
  const requested = typeof raw === "string" ? raw : null;

  const user = await getCurrentUser();
  if (!user) {
    redirect(
      signInWithNext(requested ? ROUTES.agentLinkWithCode(requested) : ROUTES.agentLink),
    );
  }

  const code = requested ? normalizeUserCode(requested) : null;
  const pending = code ? await findPendingByUserCode(code) : null;

  const [access, context] = await Promise.all([
    getAccess(user.id),
    getDashboardContext(user.id),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 py-10">
      <Logo className="mb-7" />

      <section className="w-full max-w-md rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-8">
        {pending ? (
          <AgentConsent
            code={pending.userCode}
            clientName={pending.clientName}
            domain={context.domain}
            offreLabel={OFFER_LABELS[access.tier]}
          />
        ) : (
          <AgentCodeForm invalid={Boolean(code)} />
        )}
      </section>

      <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-steel">
        Connecté en tant que {user.email}.
      </p>
    </main>
  );
}
