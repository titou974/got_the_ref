import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import {
  ARTICLE_QUOTAS,
  BOOST,
  GUARANTEE_DAYS,
  SUBSCRIPTION_PRICE,
  YEARLY_MONTHLY_PRICE,
  YEARLY_TOTAL_PRICE,
} from "@/constants/plans";

export const metadata: Metadata = { title: "CGV / CGU" };

/**
 * Les conditions du service, en une page : l'utilisation d'abord (CGU), la
 * vente ensuite (CGV). Un seul document parce qu'un abonné accepte les deux
 * d'un même clic — renvoyer d'une page à l'autre n'aiderait personne.
 *
 * Les montants viennent de `@/constants/plans`, jamais d'un littéral : le jour
 * où le tarif bouge sur la carte, il bouge ici aussi. Un contrat qui annonce un
 * prix que le checkout ne pratique plus est un contrat attaquable.
 */
export default function CgvCguPage() {
  return (
    <LegalLayout
      title="Conditions Générales de Vente et d'Utilisation"
      updated="26 août 2026"
    >
      <p>
        Les présentes Conditions Générales de Vente et d'Utilisation (ci-après les
        « Conditions ») régissent l'accès et l'utilisation de la plateforme got_the_ref
        (ci-après le « Service »), éditée et exploitée par <strong>Studio Tropiques</strong>,
        entrepreneur individuel immatriculé sous le SIRET 92430624400014, dont le siège est situé
        98 rue Montmartre, 75002 Paris (ci-après « got_the_ref », « nous »).
      </p>
      <p>
        En accédant au Service ou en l'utilisant, vous (« Utilisateur », « Client », « vous »)
        acceptez d'être lié par les présentes Conditions. Si vous ne les acceptez pas, vous ne
        pouvez pas accéder au Service ni l'utiliser. Contact :{" "}
        <strong>bobodigitalcorp@gmail.com</strong>.
      </p>

      <h2>Partie I — Conditions Générales d'Utilisation</h2>

      <h3>1. Objet du service</h3>
      <p>
        got_the_ref propose des outils numériques destinés à aider les entreprises à analyser et à
        améliorer leur visibilité dans les moteurs de réponse fondés sur l'intelligence artificielle
        et dans les moteurs de recherche. Le Service peut comprendre :
      </p>
      <ul>
        <li>le suivi des citations et des mentions de la marque dans les réponses des IA ;</li>
        <li>l'analyse GEO et SEO du site, la recherche de mots-clés et de requêtes réelles ;</li>
        <li>l'audit technique, les données structurées et le fichier llms.txt ;</li>
        <li>la génération de contenus et de corrections on-page par intelligence artificielle ;</li>
        <li>la publication de ces contenus sur les plateformes que vous connectez ;</li>
        <li>l'analyse des concurrents, l'ancrage local et la fiche d'établissement Google ;</li>
        <li>des tableaux de bord de suivi, ainsi que toute fonctionnalité ajoutée par la suite.</li>
      </ul>
      <p>
        Sous réserve de la garantie prévue à l'article 8 de la Partie II, réservée à l'abonnement
        annuel, got_the_ref ne garantit aucune amélioration de classement ni aucun résultat de
        visibilité. L'Utilisateur demeure
        seul responsable des décisions et des actions prises sur la base des analyses fournies par
        la plateforme.
      </p>

      <h3>2. Éligibilité</h3>
      <p>Vous devez :</p>
      <ul>
        <li>être âgé d'au moins 18 ans ;</li>
        <li>avoir la capacité juridique de conclure un contrat ;</li>
        <li>utiliser le Service conformément aux lois en vigueur.</li>
      </ul>

      <h3>3. Création de compte</h3>
      <p>
        L'accès à certaines fonctionnalités suppose la création d'un compte et la fourniture
        d'informations exactes. Vous êtes responsable de la confidentialité de vos identifiants
        ainsi que de toute activité réalisée depuis votre compte.
      </p>
      <p>
        got_the_ref se réserve le droit de suspendre ou de supprimer tout compte soupçonné
        d'utilisation abusive, de fraude ou de violation des présentes Conditions.
      </p>

      <h3>4. Abonnement et facturation</h3>
      <p>
        Les offres, les prix et les modalités de paiement, de reconduction, de rétractation et de
        remboursement sont décrits dans la Partie II. En résumé : l'abonnement est proposé au mois
        ou à l'année, il est reconduit automatiquement jusqu'à résiliation, et la résiliation
        s'effectue à tout moment depuis votre espace personnel.
      </p>

      <h3>5. Politique d'utilisation acceptable</h3>
      <p>Vous vous engagez à ne pas :</p>
      <ul>
        <li>utiliser le Service à des fins illégales ;</li>
        <li>tenter de procéder à l'ingénierie inverse de la plateforme ;</li>
        <li>porter atteinte à l'intégrité ou à la sécurité du système ;</li>
        <li>extraire des données, scraper ou surcharger la plateforme ;</li>
        <li>
          utiliser les contenus générés pour enfreindre les droits d'auteur, la vie privée ou la
          législation en vigueur ;
        </li>
        <li>partager l'accès à votre compte avec des utilisateurs non autorisés.</li>
      </ul>
      <p>Toute violation peut entraîner la suspension immédiate de votre compte.</p>

      <h3>6. Propriété intellectuelle</h3>
      <p>
        L'ensemble des contenus, logiciels, fonctionnalités, designs, marques et bases de données de
        la plateforme est la propriété exclusive de Studio Tropiques ou de ses concédants de
        licence. Vous bénéficiez d'une licence limitée, non exclusive et non transférable
        d'utilisation de la plateforme pour vos besoins professionnels internes, pour la durée de
        votre abonnement. Vous n'êtes pas autorisé à copier, modifier, distribuer, vendre ou créer
        des œuvres dérivées du Service.
      </p>
      <p>
        Les contenus rédigés pour votre site à partir de vos informations vous appartiennent dès
        leur paiement ; vous en assumez la responsabilité éditoriale au sens de l'article 7.
      </p>

      <h3>7. Contenu généré par intelligence artificielle</h3>
      <p>
        <strong>Portée.</strong> Dans le cadre du Service, Studio Tropiques utilise des technologies
        d'intelligence artificielle pour produire des contenus — articles, textes optimisés pour la
        recherche, corrections on-page et autres supports écrits — qui peuvent être publiés
        directement sur le site du Client.
      </p>
      <p>
        <strong>Responsabilité du Client.</strong> Le Client reconnaît qu'il est seul responsable de
        la relecture, de la validation et de l'approbation de tout contenu généré par IA, avant
        comme après sa publication. En utilisant le Service, il accepte l'entière responsabilité
        éditoriale des contenus publiés sur son domaine.
      </p>
      <p>
        <strong>Absence de garantie d'exactitude.</strong> Studio Tropiques ne garantit ni
        l'exactitude factuelle, ni l'exhaustivité, ni la fiabilité des contenus générés par
        intelligence artificielle. Ces contenus peuvent comporter des erreurs, des inexactitudes ou
        des informations obsolètes. Le Client est vivement invité à vérifier chaque affirmation,
        donnée ou déclaration avant de s'y fier ou de la publier.
      </p>
      <p>
        <strong>Propriété intellectuelle et responsabilité.</strong> Le Client assume l'entière
        responsabilité dans l'hypothèse où un contenu généré par IA publié sur son site porterait
        atteinte aux droits de propriété intellectuelle de tiers, contiendrait des propos
        diffamatoires ou serait autrement illicite. Studio Tropiques ne saurait être tenu
        responsable des réclamations, dommages ou pertes découlant de l'utilisation ou de la
        publication par le Client d'un contenu généré par IA sans examen préalable.
      </p>
      <p>
        <strong>Transparence.</strong> Conformément au règlement (UE) 2024/1689 sur l'intelligence
        artificielle, Studio Tropiques informe les utilisateurs que certains contenus produits via
        la plateforme sont générés ou assistés par des systèmes d'intelligence artificielle. Lorsque
        la loi applicable l'exige, ces contenus sont identifiés comme tels.
      </p>
      <p>
        <strong>Publication automatique.</strong> Lorsque le Client active la publication
        automatique sur une plateforme connectée, il reconnaît expressément que des contenus peuvent
        être mis en ligne sur son site sans relecture manuelle préalable. En activant cette
        fonctionnalité, il en accepte les risques et convient que Studio Tropiques ne porte aucune
        responsabilité quant aux contenus publiés automatiquement en son nom.
      </p>

      <h3>8. Connexion de sites et d'outils tiers</h3>
      <p>
        Certaines fonctionnalités supposent que le Client connecte son site (WordPress, Webflow,
        Shopify, Wix, Squarespace, PrestaShop, Framer, installation sur mesure) ou ses outils de
        mesure (Google Search Console, Google Analytics, fiche d'établissement Google). En
        fournissant ces accès, le Client autorise expressément got_the_ref à lire, créer et modifier
        les contenus et les réglages nécessaires à l'exécution du Service, dans la limite des droits
        conférés par les identifiants transmis.
      </p>
      <p>
        Cette autorisation est révocable à tout moment : le Client peut déconnecter une plateforme
        depuis son espace personnel ou révoquer les identifiants côté plateforme. La révocation met
        fin aux publications et corrections à venir, sans effet rétroactif sur les contenus déjà
        publiés, dont le Client conserve la maîtrise.
      </p>
      <p>
        Le Client est responsable de la légitimité des accès qu'il transmet et garantit disposer des
        droits nécessaires sur les sites qu'il connecte.
      </p>

      <h3>9. Données de l'Utilisateur et confidentialité</h3>
      <p>
        Les informations soumises à la plateforme ou générées par celle-ci sont traitées
        conformément à notre
        <a href="/politique-de-confidentialite"> Politique de confidentialité</a>. Vous conservez la
        propriété de vos données et concédez à got_the_ref les droits nécessaires pour les stocker,
        les analyser et les traiter afin de fournir le Service. got_the_ref ne vend aucune donnée
        personnelle.
      </p>

      <h3>10. Services tiers</h3>
      <p>Le Service intègre des services externes ou en dépend, notamment :</p>
      <ul>
        <li>des moteurs de recherche et des moteurs de réponse fondés sur l'IA ;</li>
        <li>des fournisseurs de modèles d'intelligence artificielle ;</li>
        <li>des fournisseurs de données ;</li>
        <li>Stripe, pour le traitement des paiements ;</li>
        <li>notre hébergeur, ainsi que les plateformes que vous connectez.</li>
      </ul>
      <p>
        Nous ne sommes pas responsables des interruptions, erreurs ou modifications imputables à ces
        services tiers.
      </p>

      <h3>11. Disponibilité du Service</h3>
      <p>
        Nous nous efforçons d'assurer un accès continu à la plateforme. Nous ne garantissons
        toutefois ni un service ininterrompu, ni un fonctionnement exempt d'erreurs, ni une
        compatibilité totale avec vos systèmes. Le Service peut être suspendu temporairement pour
        maintenance, mise à jour ou amélioration de sécurité.
      </p>

      <h3>12. Exonérations de garantie</h3>
      <p>
        Sous réserve de la garantie prévue à l'article 8 de la Partie II, réservée à l'abonnement
        annuel, et des garanties légales d'ordre public, la plateforme est fournie « en l'état » et « selon disponibilité ». Nous ne
        garantissons notamment pas l'amélioration d'un classement, l'augmentation du trafic,
        l'exactitude des prédictions, la fiabilité parfaite des données, ni l'obtention de résultats
        commerciaux déterminés. Vous utilisez le Service à vos propres risques.
      </p>

      <h3>13. Limitation de responsabilité</h3>
      <p>
        Dans toute la mesure permise par la loi, got_the_ref ne saurait être tenu responsable des
        pertes de revenus, de bénéfices, d'activité ou de données, des temps d'arrêt, interruptions
        de service ou erreurs, ni d'aucun dommage indirect, accessoire ou consécutif. Notre
        responsabilité totale ne pourra excéder le montant total des sommes payées par l'Utilisateur
        au cours des trois (3) mois précédant le fait générateur de la réclamation.
      </p>
      <p>
        Ces limitations ne s'appliquent ni en cas de faute lourde ou dolosive, ni dans les cas où la
        loi les interdit, notamment à l'égard des consommateurs.
      </p>

      <h3>14. Résiliation</h3>
      <p>Nous pouvons suspendre ou résilier votre accès si :</p>
      <ul>
        <li>vous enfreignez les présentes Conditions ;</li>
        <li>vous faites un usage abusif de la plateforme ;</li>
        <li>vous ne réglez pas les sommes dues au titre de l'abonnement.</li>
      </ul>
      <p>
        En cas de résiliation, votre accès est révoqué, vos données peuvent être supprimées après un
        délai raisonnable, et aucun remboursement n'est dû, sauf lorsque la loi ou l'article 7 de la
        Partie II l'impose.
      </p>

      <h3>15. Modifications des Conditions</h3>
      <p>
        Nous pouvons mettre à jour les présentes Conditions à tout moment. Les modifications
        substantielles sont communiquées par e-mail avec un préavis raisonnable. La poursuite de
        l'utilisation de la plateforme vaut acceptation des Conditions révisées.
      </p>

      <h2>Partie II — Conditions Générales de Vente</h2>
      <p>
        Les présentes conditions de vente s'appliquent à tous les produits et services fournis par
        Studio Tropiques, exploitant de la plateforme got_the_ref. Elles s'adressent principalement
        aux clients professionnels ; les consommateurs peuvent souscrire, sous réserve des
        dispositions protectrices rappelées ci-dessous.
      </p>

      <h3>1. Informations sur l'éditeur</h3>
      <ul>
        <li>Éditeur : <strong>Studio Tropiques</strong></li>
        <li>Forme juridique : entrepreneur individuel (EI), de droit français</li>
        <li>Siège : 98 rue Montmartre, 75002 Paris, France</li>
        <li>SIRET : 92430624400014</li>
        <li>Directeur de la publication : Titouan Hirsch</li>
        <li>Responsable de la protection des données : Titouan Hirsch</li>
        <li>E-mail de contact et de support : bobodigitalcorp@gmail.com</li>
      </ul>
      <p>Les présentes conditions régissent la vente :</p>
      <ul>
        <li>
          de la plateforme SaaS got_the_ref, incluant le suivi des citations par IA, les analyses
          GEO et SEO, la rédaction et la publication de contenus ;
        </li>
        <li>
          des prestations d'accompagnement fournies par Studio Tropiques (conseil, travaux
          d'optimisation) lorsqu'elles font l'objet d'un devis.
        </li>
      </ul>

      <h3>2. Définitions</h3>
      <ul>
        <li><strong>Client</strong> : tout utilisateur souscrivant un abonnement ou une prestation.</li>
        <li><strong>SaaS</strong> : la plateforme en ligne got_the_ref, accessible par abonnement.</li>
        <li>
          <strong>Coup de Boost</strong> : la passe unique des agents, payée une seule fois, sans
          reconduction.
        </li>
        <li>
          <strong>Compte gratuit</strong> : l'accès permanent et sans paiement à une partie du
          Service, sans limite de durée ni engagement.
        </li>
        <li><strong>Prestations</strong> : tout travail sur mesure fourni sur devis.</li>
      </ul>

      <h3>3. Création de compte et accès</h3>
      <p>
        La création d'un compte est gratuite et donne accès à des fonctionnalités limitées, dont une
        analyse gratuite du site. L'accès aux fonctionnalités payantes suppose un abonnement actif
        ou l'achat d'un Coup de Boost. Le Client fournit des informations de facturation exactes et
        à jour, y compris son numéro de TVA le cas échéant.
      </p>

      <h3>4. Offres et tarifs</h3>
      <p>Le Service est proposé selon les formules suivantes :</p>
      <ul>
        <li>
          <strong>Analyse gratuite</strong> : une analyse par compte, sans paiement ni engagement.
          Le résultat est un aperçu partiel, dont la note est plafonnée.
        </li>
        <li>
          <strong>Compte gratuit</strong> : accès permanent et sans paiement à la détection de
          niche du site et aux corrections de contenu associées aux mots-clés relevés. Les autres
          sections restent fermées jusqu'à la souscription d'une offre payante.
        </li>
        <li>
          <strong>Abonnement mensuel</strong> : {SUBSCRIPTION_PRICE} € par mois, accès complet à la
          plateforme et au travail des agents.
        </li>
        <li>
          <strong>Abonnement annuel</strong> : {YEARLY_MONTHLY_PRICE} € par mois, débités en une
          fois — soit {YEARLY_TOTAL_PRICE} € par an — pour douze mois d'accès.
        </li>
        <li>
          <strong>Coup de Boost</strong> : {BOOST.price} €, paiement unique, une seule passe des
          agents comprenant jusqu'à {BOOST.articles} articles rédigés. Aucune remesure dans la durée
          n'est comprise et aucune reconduction n'a lieu.
        </li>
      </ul>
      <p>
        Le rythme de rédaction des agents est limité à {ARTICLE_QUOTAS.weekly} articles par période
        glissante de sept jours ; la reprise d'un article compte comme une rédaction.
      </p>
      <p>
        Les prix sont indiqués en euros. Le cas échéant, la taxe sur la valeur ajoutée applicable
        est ajoutée au taux en vigueur ; lorsque Studio Tropiques relève de la franchise en base de
        TVA, la mention « TVA non applicable, article 293 B du CGI » figure sur la facture. Le
        montant total dû est affiché avant la confirmation du paiement.
      </p>
      <p>
        Studio Tropiques se réserve le droit de modifier ses tarifs, ses fonctionnalités et ses
        formules. Les clients en sont informés par e-mail dans un délai raisonnable ; une
        modification tarifaire n'affecte pas la période déjà payée et ne s'applique qu'à compter de
        la reconduction suivante. Le Client en désaccord avec un nouveau tarif peut résilier avant
        son entrée en vigueur.
      </p>
      <p>
        Les prestations sur mesure sont réalisées sur la base d'un devis écrit accepté par e-mail,
        qui en fixe le périmètre, les livrables et le calendrier.
      </p>

      <h3>5. Paiement, facturation et reconduction</h3>
      <p>
        Les paiements sont traités de manière sécurisée par <strong>Stripe</strong>. Aucune donnée
        bancaire n'est stockée par got_the_ref. Les factures sont émises dès la validation du
        paiement et mises à disposition dans l'espace de facturation.
      </p>
      <p>
        Les abonnements sont facturés par avance et <strong>reconduits automatiquement</strong> à
        échéance — chaque mois pour la formule mensuelle, chaque année pour la formule annuelle —
        jusqu'à résiliation. Le Coup de Boost est débité une seule fois et n'est jamais reconduit.
      </p>
      <p>
        En cas d'échec de paiement, l'accès aux fonctionnalités payantes peut être suspendu jusqu'à
        régularisation.
      </p>

      <h3>6. Livraison et exécution</h3>
      <p>
        L'accès à la plateforme est ouvert immédiatement après l'activation de l'abonnement ou le
        paiement du Coup de Boost. Les analyses, corrections et rédactions sont exécutées au fil de
        l'eau, dans la limite des quotas rappelés à l'article 4.
      </p>

      <h3>7. Rétractation, résiliation et remboursement</h3>
      <h3>7.1 Résiliation</h3>
      <p>
        Le Client peut résilier son abonnement à tout moment depuis son espace personnel ou depuis
        le portail de facturation. La résiliation prend effet au terme de la période en cours déjà
        payée, l'accès étant maintenu jusque-là. Elle n'ouvre droit à aucun remboursement en dehors
        des cas prévus ci-dessous.
      </p>

      <h3>7.2 Politique de remboursement</h3>
      <ul>
        <li>
          <strong>Abonnement mensuel</strong> : non remboursable, et hors du champ de la garantie de
          l'article 8. Il reste résiliable à tout moment, la résiliation prenant effet à la fin du
          mois déjà payé.
        </li>
        <li>
          <strong>Abonnement annuel</strong> : remboursable dans les 30 jours suivant l'achat,
          déduction faite d'un mois de service, le premier mois étant réputé consommé. Au-delà de ce
          délai, il reste couvert par la garantie de l'article 8.
        </li>
        <li>
          <strong>Coup de Boost et passes consommées</strong> : non remboursables dès lors que la
          passe des agents a été lancée.
        </li>
        <li>
          <strong>Prestations sur devis</strong> : les travaux réalisés et les frais engagés restent
          dus ; les conditions de résiliation figurent au devis.
        </li>
      </ul>
      <p>
        Ces règles s'appliquent sans préjudice de la garantie prévue à l'article 8 et du droit de
        rétractation du consommateur prévu à l'article 7.3.
      </p>

      <h3>7.3 Droit de rétractation du consommateur</h3>
      <p>
        Le consommateur dispose en principe d'un délai de quatorze (14) jours pour se rétracter d'un
        achat en ligne, conformément aux articles L221-18 et suivants du Code de la consommation et
        à la directive 2011/83/UE.
      </p>
      <p>
        Toutefois, conformément à l'article L221-28 du Code de la consommation (article 16 m) de la
        directive), ce droit ne s'applique pas à la fourniture d'un contenu numérique non fourni sur
        support matériel dont l'exécution a commencé avant la fin du délai, dès lors que :
      </p>
      <ul>
        <li>
          le consommateur a donné son accord préalable exprès à l'exécution immédiate du service en
          cochant la case prévue lors du paiement ;
        </li>
        <li>il a reconnu que cet accord entraîne la perte de son droit de rétractation ;</li>
        <li>
          Studio Tropiques lui a adressé la confirmation de cet accord par e-mail après l'achat.
        </li>
      </ul>
      <p>
        À défaut de l'une de ces conditions, le consommateur conserve le droit de se rétracter dans
        les quatorze (14) jours calendaires suivant l'achat, sans motif ni frais, en écrivant à
        bobodigitalcorp@gmail.com. En cas de rétractation valide, le remboursement intervient dans
        les quatorze (14) jours, par le même moyen de paiement que celui de la transaction
        initiale, sauf accord exprès du consommateur pour un autre moyen.
      </p>

      <h3>8. Garantie « visibilité en progrès ou remboursé » (abonnement annuel)</h3>
      <p>
        Studio Tropiques accorde aux seuls souscripteurs de l'<strong>abonnement annuel</strong> une
        garantie commerciale, distincte des garanties légales : si votre visibilité dans les moteurs
        de réponse ne progresse pas au terme de {GUARANTEE_DAYS} jours, les sommes versées au titre
        de l'abonnement annuel vous sont remboursées. L'abonnement mensuel, non remboursable au
        titre de l'article 7.2, n'ouvre pas droit à cette garantie.
      </p>
      <p>Cette garantie s'applique sous réserve que, pendant toute la période :</p>
      <ul>
        <li>l'abonnement annuel soit resté actif et à jour de paiement, sans interruption ;</li>
        <li>le site ait été connecté à la plateforme et les accès demeurés fonctionnels ;</li>
        <li>
          les corrections et les contenus produits par les agents aient été effectivement appliqués
          ou publiés sur le site.
        </li>
      </ul>
      <p>
        La demande s'effectue par e-mail à bobodigitalcorp@gmail.com dans les trente (30) jours
        suivant l'échéance des {GUARANTEE_DAYS} jours. La progression s'apprécie au regard des
        mesures enregistrées par la plateforme entre la première et la dernière analyse de la
        période. Cette garantie ne fait pas obstacle aux garanties légales de conformité et des
        vices cachés.
      </p>

      <h3>9. Obligations du Client</h3>
      <p>Le Client s'engage à :</p>
      <ul>
        <li>fournir des informations exactes, notamment de facturation ;</li>
        <li>utiliser le Service conformément aux lois en vigueur ;</li>
        <li>
          s'abstenir de toute tentative d'ingénierie inverse, d'altération ou d'usage abusif de la
          plateforme ;
        </li>
        <li>
          coopérer activement lorsque l'exécution le requiert : accès aux plateformes, documents,
          validations éditoriales.
        </li>
      </ul>

      <h3>10. Propriété intellectuelle et licence</h3>
      <p>
        La plateforme got_the_ref, ses algorithmes, sa base de données, son logiciel, son design et
        l'ensemble de ses contenus sont la propriété exclusive de Studio Tropiques. La licence
        accordée au Client est non exclusive, incessible, limitée à la durée de l'abonnement et
        consentie pour son seul usage interne.
      </p>

      <h3>11. Limitation de responsabilité</h3>
      <p>
        Les performances en référencement naturel et en visibilité dans les systèmes d'IA dépendent
        de nombreux facteurs externes. Sous réserve de la garantie de l'article 8, Studio Tropiques
        n'offre aucune garantie de résultat et ne saurait être tenu responsable des dommages
        indirects, des pertes économiques, des pertes de données ou des atteintes à la réputation.
        La responsabilité directe est limitée au montant total payé par le Client au cours des trois
        (3) mois précédant le fait générateur, sauf faute lourde ou dolosive et sauf dispositions
        légales impératives contraires.
      </p>

      <h3>12. Disponibilité, maintenance et support</h3>
      <p>
        La plateforme vise une haute disponibilité, mais peut faire l'objet d'opérations de
        maintenance planifiées ou imprévues. Le support est assuré à l'adresse
        bobodigitalcorp@gmail.com et depuis la page contact, avec un objectif de réponse sous 24
        heures ouvrées. Aucun engagement de taux de disponibilité n'est consenti en dehors d'un
        accord distinct.
      </p>

      <h3>13. Données personnelles et cookies</h3>
      <p>
        Studio Tropiques traite les données personnelles nécessaires à la gestion des comptes, à la
        facturation, au support et à l'analyse de l'usage de la plateforme. Les modalités sont
        détaillées dans la
        <a href="/politique-de-confidentialite"> Politique de confidentialité</a>. Le Client
        s'engage de son côté à respecter la réglementation applicable, notamment le RGPD, pour les
        données qu'il nous transmet.
      </p>

      <h3>14. Force majeure</h3>
      <p>
        Aucune des parties ne peut être tenue responsable d'un manquement causé par un événement
        extérieur, imprévisible et irrésistible : défaillance technique majeure, cyberattaque,
        catastrophe naturelle, décision réglementaire ou panne d'un service tiers.
      </p>

      <h3>15. Droit applicable, litiges et médiation</h3>
      <p>
        Les présentes Conditions sont régies par le droit français. Les parties rechercheront une
        solution amiable avant toute action judiciaire ; à défaut, les tribunaux français seront
        compétents, sous réserve des règles impératives applicables aux consommateurs.
      </p>
      <p>
        Conformément à l'article L612-1 du Code de la consommation, le consommateur peut recourir
        gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige
        l'opposant à Studio Tropiques, après avoir tenté de le résoudre directement auprès de nous
        par une réclamation écrite.
      </p>
      <p>
        Conformément au règlement (UE) n° 524/2013, le consommateur peut également déposer une
        réclamation sur la plateforme européenne de règlement en ligne des litiges, accessible à
        l'adresse{" "}
        <a href="https://ec.europa.eu/consumers/odr">https://ec.europa.eu/consumers/odr</a>.
      </p>

      <h3>16. Modifications</h3>
      <p>
        Studio Tropiques peut mettre à jour les présentes conditions à tout moment. Les
        modifications substantielles sont communiquées par e-mail avec un préavis raisonnable. La
        poursuite de l'utilisation du Service vaut acceptation des conditions mises à jour.
      </p>

      <h3>17. Contact</h3>
      <p>
        Pour toute question relative aux présentes Conditions ou à la facturation :{" "}
        <strong>bobodigitalcorp@gmail.com</strong> — Studio Tropiques, 98 rue Montmartre,
        75002 Paris.
      </p>
    </LegalLayout>
  );
}
