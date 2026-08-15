/**
 * Témoignages du ruban de preuves.
 *
 * Deux familles, volontairement à parité : `local` (commerces physiques) et
 * `online` (SaaS, e-commerce, activités en ligne).
 *
 * Chaque famille a sa preuve, et ce n'est pas la même :
 * — `online` porte `stats`, la capture Search Console, parce qu'une activité en
 *   ligne se mesure en trafic. La capture affiche déjà ses chiffres en clair :
 *   `clicks`, `impressions` et `position` ne sont pas réaffichés dessous, ils
 *   servent à écrire le texte alternatif de l'image ;
 * — `local` porte `aiShot`, la capture d'une réponse ChatGPT qui cite le
 *   commerce. Pour une boulangerie, la preuve est d'être nommée dans la réponse,
 *   pas une courbe de clics.
 *
 * Pour ajouter la capture d'un commerce : déposez l'image dans
 * `public/preuves-ia/` puis renseignez `aiShot` sur son témoignage. Une carte
 * sans capture reste valable, elle n'affiche que la parole.
 *
 * ⚠️ Hormis La Cotriade, les témoignages ci-dessous n'ont pas encore été
 * recueillis auprès de clients réels, et les captures proviennent de comptes
 * tiers. Tant que `PROOF_IS_ILLUSTRATIVE` vaut `true`, une mention discrète
 * apparaît sous le ruban : publier des avis inventés ou s'attribuer les
 * résultats d'autrui est une pratique commerciale trompeuse (art. L121-2 et
 * L121-4 du Code de la consommation, directive Omnibus), et la DGCCRF contrôle
 * ce point. Remplacez le contenu par des témoignages et des captures obtenus
 * avec accord, puis passez le drapeau à `false` — rien d'autre ne bouge.
 */
export const PROOF_IS_ILLUSTRATIVE = true;

/** Capture Search Console et les chiffres qu'elle affiche. */
export type ProofStats = {
  shot: string;
  clicks: string;
  impressions: string;
  position: string;
};

/**
 * Capture d'une réponse d'IA citant le commerce, avec sa description pour les
 * lecteurs d'écran. Une image de conversation ne se devine pas : décrivez ce
 * qu'on y lit (« ChatGPT recommande La Cotriade parmi trois restaurants »).
 */
export type AiProofShot = {
  src: string;
  alt: string;
};

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  kind: "local" | "online";
  /** Activités en ligne : la capture Search Console. */
  stats?: ProofStats;
  /** Commerces physiques : la capture d'une réponse d'IA qui les cite. */
  aiShot?: AiProofShot;
};

export const TESTIMONIALS: Testimonial[] = [
  // ── Commerce physique : la preuve, c'est le client qui entre ────────────────
  {
    quote:
      "Cette plateforme nous a permis de gagner des clients tout l'été, qui venaient avec GPT.",
    author: "La Cotriade",
    role: "Restaurant de fruits de mer · Les Sables-d'Olonne",
    kind: "local",
    // La capture de la réponse ChatGPT se branche ici, une fois l'image déposée
    // dans public/preuves-ia/ :
    aiShot: {
      src: "/preuves-ia/la-cotriade.jpeg",
      alt: "ChatGPT cite La Cotriade en tête des restaurants de fruits de mer aux Sables-d'Olonne",
    },
  },
  {
    quote:
      "Je n'y connais rien en technique. J'ai lancé l'analyse, les agents ont corrigé, et ma fiche remonte sur les recherches de mon quartier.",
    author: "Sarah B.",
    role: "Salon de coiffure · Nantes",
    kind: "local",
    aiShot: {
      src: "/preuves-ia/sarah-b.jpeg",
      alt: "ChatGPT recommande le salon de coiffure de Sarah B. à Nantes",
    },
  },
  {
    quote:
      "Les clients arrivent en disant « c'est l'IA qui vous a conseillé ». Il y a un an, cette phrase n'existait pas dans mon métier.",
    author: "Dr. Nicolas M.",
    role: "Cabinet dentaire · Lyon",
    kind: "local",
    aiShot: {
      src: "/preuves-ia/nicolas-m.jpeg",
      alt: "ChatGPT recommande le cabinet dentaire de Dr. Marc L. à Lyon",
    },
  },
  {
    quote:
      "Ma boulangerie ressortait derrière trois chaînes. Aujourd'hui je suis citée en premier sur ma ville dans les réponses IA.",
    author: "Camille R.",
    role: "Boulangerie artisanale · Bordeaux",
    kind: "local",
    aiShot: {
      src: "/preuves-ia/camille-r.jpeg",
      alt: "ChatGPT recommande la boulangerie artisanale de Camille R. à Bordeaux",
    },
  },
  {
    quote:
      "Le week-end, la moitié des réservations vient de gens qui ont demandé conseil à une IA. On ne les avait pas avant.",
    author: "Karim T.",
    role: "Restaurant italien · Marseille",
    kind: "local",
    aiShot: {
      src: "/preuves-ia/karim-t.jpeg",
      alt: "ChatGPT recommande le restaurant italien de Karim T. à Marseille",
    },
  },
  {
    quote:
      "On a récupéré la première place sur notre spécialité en trois semaines, sans toucher au site nous-mêmes.",
    author: "Élodie F.",
    role: "Institut de beauté · Toulouse",
    kind: "local",
    aiShot: {
      src: "/preuves-ia/elodie-f.jpeg",
      alt: "ChatGPT recommande l'institut de beauté d'Élodie F. à Toulouse",
    },
  },

  // ── Activités en ligne : la progression se lit dans Search Console ──────────
  {
    quote:
      "Aucune visibilité au lancement, aucun budget pub. Nos deux premiers clients sont arrivés en citant une réponse d'IA. C'est ce canal qui nous a démarrés.",
    author: "Julien M.",
    role: "Fondateur d'un SaaS B2B",
    kind: "online",
    stats: {
      shot: "/resultats/result-1.webp",
      clicks: "14,6 K",
      impressions: "1,31 M",
      position: "10,4",
    },
  },
  {
    quote:
      "Nos fiches produits n'étaient reprises par aucune IA. Le plan d'action a été appliqué en une semaine, le trafic de recommandation a doublé.",
    author: "Nicolas P.",
    role: "Boutique e-commerce · mode",
    kind: "online",
    stats: {
      shot: "/resultats/result-2.webp",
      clicks: "39,5 K",
      impressions: "4,01 M",
      position: "8,6",
    },
  },
  {
    quote:
      "On payait une agence au mois pour un rapport qu'on ne savait pas appliquer. Ici c'est corrigé puis remesuré, on voit enfin l'effet de chaque action.",
    author: "Amandine G.",
    role: "Agence de voyage en ligne",
    kind: "online",
    stats: {
      shot: "/resultats/result-3.webp",
      clicks: "30,1 K",
      impressions: "1,03 M",
      position: "8,5",
    },
  },
  {
    quote:
      "Notre documentation était invisible pour les modèles. Une fois structurée, on est devenus la source citée sur notre catégorie.",
    author: "Thomas D.",
    role: "Fondateur d'un SaaS analytics",
    kind: "online",
    stats: {
      shot: "/resultats/result-4.webp",
      clicks: "143 K",
      impressions: "2,64 M",
      position: "9",
    },
  },
  {
    quote:
      "Le catalogue est énorme, personne ne pouvait tout optimiser à la main. Les agents s'en occupent en continu et la courbe ne redescend plus.",
    author: "Sofiane B.",
    role: "Marketplace e-commerce",
    kind: "online",
    stats: {
      shot: "/resultats/result-5.webp",
      clicks: "3,18 M",
      impressions: "108 M",
      position: "10,7",
    },
  },
  {
    quote:
      "Je vends une formation en ligne. Être cité par ChatGPT sur ma thématique m'a apporté plus d'inscrits que six mois de publicité.",
    author: "Laure V.",
    role: "Formatrice indépendante en ligne",
    kind: "online",
    stats: {
      shot: "/resultats/result-6.webp",
      clicks: "74,1 K",
      impressions: "4,35 M",
      position: "7,3",
    },
  },
];
