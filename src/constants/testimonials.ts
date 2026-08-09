/**
 * ⚠️ CONTENU D'EXEMPLE — À REMPLACER AVANT LA MISE EN PRODUCTION
 *
 * Ces témoignages sont des maquettes destinées à valider la mise en page. Ils ne
 * correspondent à aucun client réel. Publier des avis inventés attribués à des
 * personnes ou des commerces fictifs constitue une pratique commerciale
 * trompeuse (art. L121-2 et L121-4 du Code de la consommation, directive
 * Omnibus) : c'est passible de sanctions et la DGCCRF contrôle activement ce
 * point depuis 2022.
 *
 * Tant que `TESTIMONIALS_ARE_PLACEHOLDERS` vaut `true`, chaque carte porte un
 * badge « Exemple » visible : rien ne peut être pris pour un vrai avis.
 *
 * Pour passer en production : remplacez les entrées ci-dessous par des
 * témoignages réellement recueillis (avec l'accord écrit des personnes citées),
 * puis passez le drapeau à `false`. La structure ne change pas.
 */
export const TESTIMONIALS_ARE_PLACEHOLDERS = true;

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  /** `local` = commerce physique, `online` = activité en ligne. Sert à l'équilibre. */
  kind: "local" | "online";
};

/** Maquettes : parité voulue entre commerces physiques et activités en ligne. */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "On sortait sur Google, jamais dans ChatGPT. Deux mois après, on est cité dans les réponses sur « meilleur restaurant de fruits de mer » — et les réservations suivent.",
    author: "Exemple de témoignage",
    role: "Restaurant · commerce physique",
    kind: "local",
  },
  {
    quote:
      "Zéro visibilité au lancement, aucun budget pub. Nos deux premiers clients sont arrivés en nous citant une réponse d'IA. C'est ce canal qui nous a démarrés.",
    author: "Exemple de témoignage",
    role: "SaaS B2B · activité en ligne",
    kind: "online",
  },
  {
    quote:
      "Je n'y connais rien en technique. J'ai lancé l'analyse, les agents ont corrigé, et ma fiche remonte sur les recherches de mon quartier.",
    author: "Exemple de témoignage",
    role: "Salon de coiffure · commerce physique",
    kind: "local",
  },
  {
    quote:
      "Nos fiches produits n'étaient reprises par aucune IA. Le plan d'action a été appliqué en une semaine, le trafic de recommandation a doublé.",
    author: "Exemple de témoignage",
    role: "E-commerce · activité en ligne",
    kind: "online",
  },
  {
    quote:
      "Les clients arrivent en disant « c'est l'IA qui vous a conseillé ». Avant, cette phrase n'existait pas dans mon métier.",
    author: "Exemple de témoignage",
    role: "Cabinet dentaire · commerce physique",
    kind: "local",
  },
  {
    quote:
      "On payait une agence au mois pour un rapport qu'on ne savait pas appliquer. Là, c'est corrigé puis remesuré — on voit enfin l'effet.",
    author: "Exemple de témoignage",
    role: "Agence de voyage en ligne · activité en ligne",
    kind: "online",
  },
  {
    quote:
      "Ma boulangerie ressortait derrière trois chaînes. Aujourd'hui je suis citée en premier sur ma ville dans les réponses IA.",
    author: "Exemple de témoignage",
    role: "Boulangerie · commerce physique",
    kind: "local",
  },
  {
    quote:
      "Le constat gratuit a suffi à comprendre le problème. L'abonnement a servi à le régler sans mobiliser notre développeur.",
    author: "Exemple de témoignage",
    role: "Studio de développement · activité en ligne",
    kind: "online",
  },
];

/**
 * Captures de Search Console illustrant la progression de sites accompagnés.
 * ⚠️ À remplacer par des captures de vos propres clients, avec leur accord :
 * présenter les résultats d'un tiers comme les siens serait tout aussi trompeur.
 */
export type ResultShot = {
  src: string;
  clicks: string;
  impressions: string;
  position: string;
};

export const RESULT_SHOTS: ResultShot[] = [
  { src: "/resultats/result-1.webp", clicks: "14,6 K", impressions: "1,31 M", position: "10,4" },
  { src: "/resultats/result-2.webp", clicks: "39,5 K", impressions: "4,01 M", position: "8,6" },
  { src: "/resultats/result-3.webp", clicks: "30,1 K", impressions: "1,03 M", position: "8,5" },
  { src: "/resultats/result-4.webp", clicks: "143 K", impressions: "2,64 M", position: "9" },
  { src: "/resultats/result-5.webp", clicks: "3,18 M", impressions: "108 M", position: "10,7" },
  { src: "/resultats/result-6.webp", clicks: "74,1 K", impressions: "4,35 M", position: "7,3" },
];
