import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="13 juin 2026">
      <p>
        La présente politique décrit la manière dont <strong>[Raison sociale]</strong> (ci-après
        « nous ») collecte et traite vos données personnelles dans le cadre du service got_the_ref,
        conformément au Règlement Général sur la Protection des Données (RGPD - UE 2016/679) et à la
        loi « Informatique et Libertés ».
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est <strong>[Raison sociale]</strong>, [adresse]. Pour toute
        question relative à vos données : [contact@boostgeo.fr].
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li><strong>Données de compte</strong> : adresse e-mail, nom (facultatif), mot de passe (stocké de manière chiffrée).</li>
        <li><strong>Données d'utilisation</strong> : URL des sites analysés, historique et résultats des analyses.</li>
        <li><strong>Données de paiement</strong> : gérées exclusivement par Stripe ; nous ne stockons aucune donnée bancaire.</li>
        <li><strong>Données techniques</strong> : journaux de connexion strictement nécessaires au fonctionnement et à la sécurité.</li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li>Fourniture du Service et gestion du compte — <em>exécution du contrat</em>.</li>
        <li>Facturation et gestion des abonnements — <em>exécution du contrat / obligation légale</em>.</li>
        <li>Amélioration et sécurité du Service — <em>intérêt légitime</em>.</li>
        <li>Envoi d'informations commerciales — <em>consentement</em>, révocable à tout moment.</li>
      </ul>

      <h2>4. Destinataires</h2>
      <p>
        Vos données sont accessibles à notre personnel habilité et à nos sous-traitants techniques :
      </p>
      <ul>
        <li><strong>Stripe</strong> — traitement des paiements ;</li>
        <li><strong>Anthropic</strong> — fourniture du modèle d'IA utilisé pour générer les analyses ;</li>
        <li>notre hébergeur — stockage des données.</li>
      </ul>
      <p>
        Certains prestataires peuvent traiter des données hors de l'Union européenne ; dans ce cas,
        des garanties appropriées (clauses contractuelles types) sont mises en place.
      </p>

      <h2>5. Durée de conservation</h2>
      <p>
        Les données de compte sont conservées tant que le compte est actif, puis supprimées dans un
        délai de 12 mois après sa fermeture. Les données de facturation sont conservées 10 ans
        conformément aux obligations comptables.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition
        et de portabilité de vos données, ainsi que du droit de définir des directives relatives à
        leur sort après votre décès. Pour les exercer, écrivez à [contact@boostgeo.fr]. Vous pouvez
        introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr">www.cnil.fr</a>).
      </p>

      <h2>7. Cookies</h2>
      <p>
        got_the_ref utilise uniquement des cookies strictement nécessaires à l'authentification et au
        fonctionnement du Service. Ces cookies ne nécessitent pas de consentement préalable. Aucun
        cookie publicitaire ou de traçage tiers n'est déposé sans votre accord.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées (chiffrement
        des mots de passe, connexions sécurisées HTTPS, contrôle des accès) afin de protéger vos
        données contre tout accès non autorisé.
      </p>
    </LegalLayout>
  );
}
