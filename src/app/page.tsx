import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProofSection } from "@/components/ProofSection";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { HomeHero, HERO_ID } from "@/components/home/HomeHero";
import { StickyCtaBar } from "@/components/home/StickyCtaBar";
import { SectorsMarquee } from "@/components/home/SectorsMarquee";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FeatureCards } from "@/components/home/FeatureCards";
import { Audiences } from "@/components/home/Audiences";
import { QueryChips } from "@/components/home/QueryChips";
import { FreeAuditSection } from "@/components/home/FreeAuditSection";
import { ExamplesSection } from "@/components/home/ExamplesSection";
import { CitationNetwork } from "@/components/home/CitationNetwork";
import { RankAndMentions } from "@/components/home/RankAndMentions";
import { PricingComparison } from "@/components/pricing/PricingComparison";
import { DemoCtaSection } from "@/components/home/DemoCtaSection";
import { Faq } from "@/components/home/Faq";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveAuthDestination } from "@/features/auth/destination";
import { ROUTES } from "@/constants/routes";
import { TRIAL } from "@/constants/plans";

/**
 * La home suit une progression volontaire : promesse → secteurs → méthode →
 * résultats → produit → analyse gratuite → exemples → preuves → réseau →
 * Google et assistants → comparatif agence → démo → questions.
 *
 * Le prix n'arrive qu'à la fin, une fois la démonstration faite ; la démo prend
 * le relais juste après, pour qui préfère en parler plutôt que souscrire.
 *
 * Rien ne s'intercale avant : le visiteur voit le tarif sans avoir à ouvrir de
 * compte. L'inscription reste accessible par la barre, mais elle ne barre plus
 * la route au prix — ce verrou vit sur la branche `worktree-auth-gate`.
 *
 * Le champ d'analyse ne vit plus dans le hero : en haut, un seul geste est
 * proposé (démarrer l'essai) à côté de la conversation IA qui se joue seule.
 * L'analyse arrive une fois la démonstration faite, là où coller son adresse a
 * un sens — l'ancre `#analyser` reste valable pour tous les liens du site.
 *
 * Un client déjà engagé ne voit pas cette page : elle argumente pour une
 * décision qu'il a déjà prise. On l'emmène là où il en est — le tunnel d'accueil
 * tant qu'il n'a pas donné l'adresse de son site, son tableau de bord ensuite.
 * C'est le même arbitrage qu'après une connexion, et il est écrit au même
 * endroit (`resolveAuthDestination`) : deux versions de cette règle finiraient
 * par diverger, et l'une des deux déposerait quelqu'un sur un écran vide.
 *
 * Une seule sortie de cet arbitrage n'est pas suivie ici : les tarifs. C'est là
 * qu'il dépose un compte qui vient de naître — après une inscription, c'est
 * juste, la décision est l'étape suivante. Depuis la home, non : ce compte-là
 * en revient précisément, et l'y renvoyer l'enfermait sur la grille des prix,
 * sans retour possible. Il reste donc ici, et il y trouve le formulaire
 * d'analyse — la seule porte vers l'espace de travail, celle que ni la barre de
 * navigation ni l'appel flottant ne doublent.
 */
export default async function Home() {
  const user = await getCurrentUser();
  const destination = user ? await resolveAuthDestination(user.id, null) : null;
  if (destination && destination !== ROUTES.pricing) redirect(destination);

  const t = await getTranslations("homeHero");

  return (
    <main className="flex min-h-dvh flex-col">
      <Nav />

      <HomeHero />
      <SectorsMarquee />
      <HowItWorks />

      {/* Ce que ça change, chiffres et paroles de clients à l'appui */}
      <ResultsCarousel className="py-10 sm:py-14" />

      {/* Le produit, carte par carte */}
      <FeatureCards />

      {/* Les deux publics : en ligne et de quartier */}
      <Audiences />

      {/* Les requêtes suivies : ce que got_the_ref écoute vraiment */}
      <QueryChips />

      {/* L'analyse gratuite, une fois la démonstration faite */}
      <FreeAuditSection />

      {/* L'article produit pour un site donné, onglet par onglet */}
      <ExamplesSection />

      {/* Preuve : un commerce réel cité par les IA, et le client qui en est venu */}
      <ProofSection />

      <CitationNetwork />
      <RankAndMentions />

      {/* Ce que l'abonnement évite, sans annoncer de montant : le prix se
          découvre sur /tarifs, une fois le visiteur identifié. */}
      <div className="mx-auto w-full max-w-5xl px-5 pb-4">
        <PricingComparison />
      </div>
      <DemoCtaSection />

      <Faq />
      <Footer />

      {/* Le CTA revient par le bas dès que le hero est dépassé, pour que
          l'entrée reste à portée sur toute la longueur de la page.

          Deux visiteurs le lisent, et il ne les emmène pas au même endroit :
          l'anonyme ouvre un compte, celui qui en a déjà un — sans rien avoir
          pris ni analysé — va voir les offres. Ni l'un ni l'autre n'entre par
          ici dans le tunnel d'accueil ou le tableau de bord : cette porte-là
          est le formulaire d'analyse, plus haut dans la page. */}
      <StickyCtaBar
        label={t("trialBarCta", { days: TRIAL.days })}
        heroId={HERO_ID}
        href={user ? ROUTES.pricing : ROUTES.signUp}
      />
    </main>
  );
}
