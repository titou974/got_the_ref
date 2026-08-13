import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProofSection } from "@/components/ProofSection";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { ScrollTopCta } from "@/components/ScrollTopCta";
import { HomeHero } from "@/components/home/HomeHero";
import { SectorsMarquee } from "@/components/home/SectorsMarquee";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FeatureCards } from "@/components/home/FeatureCards";
import { QueryChips } from "@/components/home/QueryChips";
import { FreeAuditSection } from "@/components/home/FreeAuditSection";
import { ExamplesSection } from "@/components/home/ExamplesSection";
import { CitationNetwork } from "@/components/home/CitationNetwork";
import { RankAndMentions } from "@/components/home/RankAndMentions";
import { Faq } from "@/components/home/Faq";
import { getTranslations } from "next-intl/server";

/**
 * La home suit une progression volontaire : promesse → secteurs → méthode →
 * résultats → produit → analyse gratuite → exemples → preuves → réseau →
 * Google et assistants → questions.
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

      <Faq />
      <Footer />

      <ScrollTopCta label={t("scrollHint")} />
    </main>
  );
}
