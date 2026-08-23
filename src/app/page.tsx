import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProofSection } from "@/components/ProofSection";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { ScrollTopCta } from "@/components/ScrollTopCta";
import { HomeHero } from "@/components/home/HomeHero";
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

/**
 * La home suit une progression volontaire : promesse → secteurs → méthode →
 * résultats → produit → analyse gratuite → exemples → preuves → réseau →
 * Google et assistants → comparatif agence → démo → questions.
 *
 * Aucun montant n'est affiché ici. La home vend la démonstration ; le prix vit
 * sur `/tarifs`, où l'on n'arrive qu'une fois identifié — l'inscription s'est
 * intercalée entre les deux. Le comparatif agence reste : il dit ce que
 * l'abonnement évite, sans annoncer de chiffre.
 *
 * Le champ d'analyse ne vit plus dans le hero : en haut, un seul geste est
 * proposé (démarrer l'essai) à côté de la conversation IA qui se joue seule.
 * L'analyse arrive une fois la démonstration faite, là où coller son adresse a
 * un sens — l'ancre `#analyser` reste valable pour tous les liens du site.
 */
export default async function Home() {
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
      {/* 
      <ScrollTopCta label={t("scrollHint")} /> */}
    </main>
  );
}
