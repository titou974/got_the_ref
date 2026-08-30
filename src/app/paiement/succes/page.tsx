import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { PostCheckoutAccountForm } from "@/components/PostCheckoutAccountForm";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BOOST_CHECKOUT_KIND,
  SUBSCRIPTION_CHECKOUT_KIND,
  grantBoostFromSession,
  unlockAnalysisFromSession,
} from "@/features/billing/unlock";
import { ensurePaidAnalysis } from "@/features/analysis/service";
import { CLAIM_METADATA_KEY, claimMatches } from "@/features/billing/claim";
import { isOnboardingComplete } from "@/features/onboarding/queries";
import { ROUTES } from "@/constants/routes";

type Props = { searchParams: Promise<{ session_id?: string }> };

/**
 * Les trois retours possibles de Stripe : un rapport débloqué, un abonnement
 * souscrit, un Coup de Boost payé. Même page, même formulaire — seules les phrases
 * changent, et elles doivent nommer ce qui vient d'être acheté.
 */
const SUBTITLES = {
  report: {
    fresh: "subtitle",
    existing: "existingSubtitle",
    otherDevice: "otherDeviceSubtitle",
    skip: "skip",
  },
  subscription: {
    fresh: "subscriptionSubtitle",
    existing: "subscriptionExistingSubtitle",
    otherDevice: "subscriptionOtherDeviceSubtitle",
    skip: "subscriptionSkip",
  },
  boost: {
    fresh: "boostSubtitle",
    existing: "boostExistingSubtitle",
    otherDevice: "boostOtherDeviceSubtitle",
    skip: "subscriptionSkip",
  },
} as const;

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

  // Coup de Boost : l'offre est posée sur le compte du payeur dès le retour,
  // sans attendre le webhook — le client enchaîne souvent sur son tableau de
  // bord, et il doit y trouver la structure ouverte.
  if (session) await grantBoostFromSession(session, unlocked?.userId);

  // Lance l'audit complet (DeepSeek + moteurs live) dès maintenant : le visiteur
  // patiente ici de toute façon, autant qu'il découvre le vrai rapport tout de
  // suite plutôt qu'au prochain chargement de la page d'analyse.
  if (unlocked) await ensurePaidAnalysis(unlocked.analysisId);

  // Payé depuis la carte tarif — abonnement ou Coup de Boost : aucun rapport à
  // ouvrir, mais le paiement vaut engagement, il reste à créer le compte.
  const kind = session?.metadata?.kind;
  const paidWithoutReport =
    !unlocked &&
    (kind === SUBSCRIPTION_CHECKOUT_KIND || kind === BOOST_CHECKOUT_KIND) &&
    session?.payment_status !== "unpaid";

  // Ce qu'on vient d'acheter décide de la phrase d'accueil : un rapport ouvert
  // prime toujours, sinon c'est l'offre réglée qui parle.
  const variant = unlocked ? "report" : kind === BOOST_CHECKOUT_KIND ? "boost" : "subscription";
  const copy = SUBTITLES[variant];

  const payerEmail = unlocked?.email ?? session?.customer_details?.email ?? null;

  if (!unlocked && !paidWithoutReport) {
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

  // Déjà connecté : rien à créer. Reste à savoir où l'emmener — le
  // questionnaire d'accueil tant qu'il n'a pas été rempli, puisque c'est lui qui
  // arme les agents ; son rapport ou son espace client une fois répondu.
  const user = await getCurrentUser();
  if (user) {
    if (!(await isOnboardingComplete(user.id))) redirect(ROUTES.onboarding);
    redirect(unlocked ? ROUTES.analysis(unlocked.analysisId) : ROUTES.account);
  }

  // Un compte existe déjà pour cet e-mail : on propose la connexion.
  const existing = payerEmail
    ? await prisma.user.findUnique({
        where: { email: payerEmail },
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
          {existing ? t(copy.existing) : canClaim ? t(copy.fresh) : t(copy.otherDevice)}
        </p>

        {existing || !canClaim ? (
          <Link
            href={ROUTES.signIn}
            className="block w-full cursor-pointer rounded-full bg-cta py-3 text-center font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
          >
            {t("signIn")}
          </Link>
        ) : (
          <PostCheckoutAccountForm sessionId={sessionId} email={payerEmail ?? ""} />
        )}

        <Link
          href={unlocked ? ROUTES.analysis(unlocked.analysisId) : ROUTES.home}
          className="mt-4 block cursor-pointer text-center text-sm text-muted underline decoration-pebble underline-offset-4 hover:text-text"
        >
          {t(copy.skip)}
        </Link>
      </div>
    </main>
  );
}
