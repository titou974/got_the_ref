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
import { resolveHomeDestination } from "@/features/auth/destination";
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
 * Un client dont l'espace tourne ne voit pas cette page : elle argumente pour
 * une décision qu'il a déjà prise. On l'emmène là où il en est — le tunnel
 * d'accueil s'il a pris un essai ou un abonnement sans avoir encore lancé son
 * analyse, son tableau de bord dès qu'elle existe.
 *
 * Mais un compte gratuit tout juste ouvert, lui, reste ici. Il vient souvent de
 * la flèche de retour des tarifs, et l'expédier dans le tunnel d'accueil le
 * piégeait : chaque retour arrière le ramenait à la home, qui le renvoyait au
 * tunnel. La règle est écrite une fois pour toutes dans
 * `resolveHomeDestination` — voir aussi `resolveAuthDestination`, qui répond à
 * la question voisine mais différente du lendemain d'une identification.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    const destination = await resolveHomeDestination(user.id);
    if (destination) redirect(destination);
  }

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

          Un compte gratuit lit maintenant cette page lui aussi : pour lui,
          l'appel mène aux offres — l'essai s'y prend — et non au formulaire
          d'inscription, qu'il a déjà rempli. */}
      <StickyCtaBar
        label={t("trialBarCta", { days: TRIAL.days })}
        heroId={HERO_ID}
        href={user ? ROUTES.pricing : ROUTES.signUp}
      />
    </main>
  );
}
