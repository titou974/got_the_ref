import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { PostCheckoutAccountForm } from "@/components/PostCheckoutAccountForm";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlockAnalysisFromSession } from "@/features/billing/unlock";
import { CLAIM_METADATA_KEY, claimMatches } from "@/features/billing/claim";
import { ROUTES } from "@/constants/routes";

type Props = { searchParams: Promise<{ session_id?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("postCheckout");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function PaiementSuccesPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect(ROUTES.home);

  const t = await getTranslations("postCheckout");

  // On débloque dès le retour de Stripe, sans attendre le webhook : l'utilisateur
  // ne doit jamais revenir sur un rapport encore verrouillé après avoir payé.
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    session = null;
  }

  const unlocked = session ? await unlockAnalysisFromSession(session) : null;

  if (!unlocked) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 text-center">
        <Logo className="mb-8" />
        <h1 className="text-2xl font-bold">{t("pendingTitle")}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">{t("pendingBody")}</p>
        <Link href={ROUTES.home} className="mt-6 cursor-pointer text-sm text-muted hover:text-text">
          {t("backHome")}
        </Link>
      </main>
    );
  }

  // Déjà connecté : rien à créer, on l'emmène droit sur son rapport complet.
  const user = await getCurrentUser();
  if (user) redirect(ROUTES.analysis(unlocked.analysisId));

  // Un compte existe déjà pour cet e-mail : on propose la connexion.
  const existing = unlocked.email
    ? await prisma.user.findUnique({
        where: { email: unlocked.email },
        select: { id: true },
      })
    : null;

  // Le rapport reste accessible par son lien, mais ouvrir un compte à l'adresse
  // du payeur n'est proposé qu'au navigateur qui a réellement payé.
  const canClaim = await claimMatches(session?.metadata?.[CLAIM_METADATA_KEY]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <Logo className="mb-8" />

      <div className="w-full max-w-sm rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-8">
        <span
          aria-hidden
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-obsidian text-white"
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

        <h1 className="text-center text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 mb-6 text-center text-sm text-muted">
          {existing ? t("existingSubtitle") : canClaim ? t("subtitle") : t("otherDeviceSubtitle")}
        </p>

        {existing || !canClaim ? (
          <Link
            href={ROUTES.signIn}
            className="block w-full cursor-pointer rounded-full bg-cta py-3 text-center font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
          >
            {t("signIn")}
          </Link>
        ) : (
          <PostCheckoutAccountForm sessionId={sessionId} email={unlocked.email ?? ""} />
        )}

        <Link
          href={ROUTES.analysis(unlocked.analysisId)}
          className="mt-4 block cursor-pointer text-center text-sm text-muted underline decoration-pebble underline-offset-4 hover:text-text"
        >
          {t("skip")}
        </Link>
      </div>
    </main>
  );
}
