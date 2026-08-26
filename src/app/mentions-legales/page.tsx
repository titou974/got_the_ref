import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updated="13 juin 2026">
      <p>
        Conformément aux dispositions des articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004
        pour la confiance dans l'économie numérique (LCEN), il est porté à la connaissance des
        utilisateurs du site got_the_ref les présentes mentions légales.
      </p>

      <h2>1. Éditeur du site</h2>
      <p>
        Le site got_the_ref est édité par <strong>Studio Tropiques</strong>, entrepreneur individuel
        de droit français.
      </p>
      <ul>
        <li>Siège social : 98 rue Montmartre, 75002 Paris, France</li>
        <li>SIRET : 92430624400014</li>
        <li>
          Numéro de TVA intracommunautaire : le cas échéant ; à défaut, TVA non applicable
          (article 293 B du CGI)
        </li>
        <li>Adresse e-mail : bobodigitalcorp@gmail.com</li>
        <li>Directeur de la publication : Thibault Besson Magdelain</li>
      </ul>

      <h2>2. Hébergement</h2>
      <p>
        Le site est hébergé par <strong>[Nom de l'hébergeur]</strong>, [adresse de l'hébergeur],
        téléphone : [numéro].
      </p>

      <h2>3. Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments composant le site (textes, graphismes, logo, marque, interface,
        code source) est la propriété exclusive de l'éditeur ou de ses partenaires et est protégé
        par le droit de la propriété intellectuelle. Toute reproduction, représentation,
        modification ou exploitation, totale ou partielle, sans autorisation écrite préalable, est
        interdite.
      </p>

      <h2>4. Responsabilité</h2>
      <p>
        Les analyses fournies par got_the_ref reposent sur des données collectées automatiquement et
        sur des estimations générées par intelligence artificielle. Elles sont communiquées à titre
        indicatif et ne sauraient constituer une garantie de résultat en matière de référencement
        ou de visibilité. L'éditeur ne saurait être tenu responsable des décisions prises sur la
        base de ces analyses.
      </p>

      <h2>5. Liens hypertextes</h2>
      <p>
        Le site peut contenir des liens vers des sites tiers. L'éditeur n'exerce aucun contrôle sur
        ces sites et décline toute responsabilité quant à leur contenu.
      </p>

      <h2>6. Droit applicable</h2>
      <p>
        Les présentes mentions légales sont soumises au droit français. Tout litige relève de la
        compétence des tribunaux français.
      </p>
    </LegalLayout>
  );
}
