import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = { title: "CGV / CGU" };

export default function CgvCguPage() {
  return (
    <LegalLayout title="Conditions Générales de Vente et d'Utilisation" updated="13 juin 2026">
      <p>
        Les présentes Conditions Générales de Vente et d'Utilisation (ci-après « CGV/CGU »)
        régissent l'accès et l'utilisation du service GEOBoost (ci-après le « Service »), édité par
        <strong> [Raison sociale]</strong>. Toute souscription ou utilisation du Service implique
        l'acceptation pleine et entière des présentes.
      </p>

      <h2>1. Objet</h2>
      <p>
        GEOBoost est un outil en ligne (SaaS) permettant d'analyser la visibilité d'un site web dans
        les moteurs de recherche fondés sur l'intelligence artificielle (ChatGPT, Perplexity,
        Gemini, Google AI Overviews) ainsi que son référencement naturel, et de fournir des
        recommandations d'optimisation.
      </p>

      <h2>2. Compte utilisateur</h2>
      <p>
        L'accès à certaines fonctionnalités nécessite la création d'un compte. L'utilisateur
        s'engage à fournir des informations exactes et à préserver la confidentialité de ses
        identifiants. Il est responsable de toute activité réalisée depuis son compte.
      </p>

      <h2>3. Offres et tarifs</h2>
      <p>Le Service est proposé selon les formules suivantes :</p>
      <ul>
        <li><strong>Gratuit</strong> : 3 analyses au total, sans engagement.</li>
        <li><strong>Pro</strong> : 29 € / mois, 50 analyses par mois.</li>
        <li><strong>Agence</strong> : 99 € / mois, analyses illimitées.</li>
      </ul>
      <p>
        Les prix sont indiqués en euros. La TVA applicable est ajoutée le cas échéant. L'éditeur se
        réserve le droit de modifier ses tarifs ; les modifications n'affectent pas les abonnements
        en cours avant leur reconduction.
      </p>

      <h2>4. Paiement</h2>
      <p>
        Les paiements sont traités de manière sécurisée par notre prestataire <strong>Stripe</strong>.
        Les abonnements sont facturés mensuellement par avance et reconduits automatiquement à
        échéance, sauf résiliation.
      </p>

      <h2>5. Droit de rétractation</h2>
      <p>
        Conformément à l'article L221-28 du Code de la consommation, le consommateur reconnaît
        que le Service, de nature numérique, est fourni immédiatement après souscription. En
        demandant l'exécution immédiate, l'utilisateur renonce expressément à son droit de
        rétractation pour la partie du service déjà exécutée. Hors cette exécution, le délai légal
        de rétractation de 14 jours s'applique pour les consommateurs.
      </p>

      <h2>6. Résiliation</h2>
      <p>
        L'utilisateur peut résilier son abonnement à tout moment depuis son espace personnel ou via
        le portail de facturation. La résiliation prend effet à la fin de la période en cours
        déjà payée, sans remboursement au prorata.
      </p>

      <h2>7. Disponibilité du Service</h2>
      <p>
        L'éditeur s'efforce d'assurer la disponibilité du Service 24h/24 mais ne garantit pas une
        accessibilité ininterrompue. Des interruptions pour maintenance ou cas de force majeure
        peuvent survenir sans ouvrir droit à indemnisation.
      </p>

      <h2>8. Limitation de responsabilité</h2>
      <p>
        Les analyses et recommandations sont fournies à titre informatif et reposent sur des
        estimations algorithmiques. L'éditeur ne garantit aucun résultat précis en matière de
        référencement ou de positionnement et ne saurait être tenu responsable des conséquences
        directes ou indirectes de l'utilisation du Service.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans notre
        <a href="/politique-de-confidentialite"> Politique de confidentialité</a>.
      </p>

      <h2>10. Droit applicable et litiges</h2>
      <p>
        Les présentes CGV/CGU sont soumises au droit français. En cas de litige, une solution
        amiable sera recherchée avant toute action judiciaire. À défaut, les tribunaux français
        seront compétents. Conformément à l'article L612-1 du Code de la consommation, le
        consommateur peut recourir gratuitement à un médiateur de la consommation.
      </p>
    </LegalLayout>
  );
}
