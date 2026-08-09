/**
 * Méthodologie GEO prête pour le prompt — vendorisée depuis les skills Claude
 * Code `geo-audit` et `geo` (voir ./methodology/*.md), adaptée à la structure du
 * dashboard got_the_ref. Injectée dans l'appel Claude Opus 4.8 pour que l'audit en
 * production suive exactement la même grille que le skill.
 *
 * NE PAS reformuler à la légère : c'est la source de vérité de la notation.
 */

/** Grille officielle des 6 catégories + interprétation + sévérités (geo-audit). */
export const GEO_AUDIT_METHODOLOGY = `GRILLE D'AUDIT GEO (issue du skill geo-audit) — barème officiel, à appliquer rigoureusement.

Score composite GEO (0-100) = moyenne pondérée de 6 catégories :
- AI Citability (25%) : à quel point le contenu est citable/extractible par les IA — blocs-réponses auto-portants de 40-160 mots, structure question/réponse, densité de faits et chiffres, accès des crawlers IA (robots.txt, llms.txt).
- Brand Authority (20%) : signaux d'autorité tiers — mentions probables sur Reddit, YouTube, Wikipedia, LinkedIn, presse ; reconnaissance d'entité (les mentions corrèlent 3x plus que les backlinks pour la citation IA).
- Content E-E-A-T (20%) : Expérience, Expertise, Autorité, Confiance — bios d'auteur et crédentials, citations de sources, données originales, fraîcheur, profondeur, qualité de la page « À propos ».
- Technical GEO (15%) : accès des crawlers IA, rendu (SSR vs JS-only), HTTPS, mobile/viewport, crawlabilité, sitemap, vitesse, sécurité.
- Schema & Structured Data (10%) : complétude et validité du JSON-LD/schema.org, types pertinents au type d'activité, opportunités manquantes.
- Platform Optimization (10%) : préparation spécifique aux plateformes que les IA citent/entraînent (Google AI Overviews, ChatGPT Search, Perplexity, Gemini, Bing Copilot).

INTERPRÉTATION DU SCORE :
- 90-100 Excellent : optimisation GEO de premier ordre, très probablement cité par les IA.
- 75-89 Bon : socle solide, marges d'amélioration.
- 60-74 Correct : présence GEO modérée, opportunités significatives.
- 40-59 Faible : signaux GEO insuffisants, les IA peinent à citer/recommander.
- 0-39 Critique : optimisation minimale, site quasi invisible pour les IA.

CLASSIFICATION DE SÉVÉRITÉ DES PROBLÈMES (pour prioriser les recommandations) :
- critique (corriger immédiatement) : tous les crawlers IA bloqués ; aucun contenu indexable (JS sans SSR) ; noindex global ; 5xx sur pages clés ; aucune donnée structurée ; marque non reconnue comme entité.
- haute (sous 1 semaine) : crawlers IA clés bloqués (GPTBot, ClaudeBot, PerplexityBot) ; pas de llms.txt ; aucun bloc question/réponse ; schema Organization/LocalBusiness manquant ; aucune attribution d'auteur.
- moyenne (sous 1 mois) : blocage partiel des crawlers ; llms.txt incomplet ; blocs citabilité < 50 ; FAQ schema manquant ; bios d'auteur sans crédentials ; pas de présence Wikipedia/Reddit.
- basse (quand possible) : erreurs de validation schema mineures ; images sans alt ; fraîcheur sur pages secondaires ; Open Graph manquant ; hiérarchie de titres sous-optimale.

AJUSTEMENTS SELON LE TYPE DE COMMERCE :
- Local / commerce physique : poids accru sur cohérence NAP, signaux Google Business Profile, schema local (LocalBusiness, GeoCoordinates, OpeningHoursSpecification), pages de zone de service, markup d'avis.
- SaaS / logiciel : tableaux comparatifs de fonctionnalités (très citables), pages d'intégration, qualité de la doc ; schema SoftwareApplication, FAQPage, HowTo.
- E-commerce : descriptions produit, guides d'achat, comparatifs ; schema Product, AggregateRating, Offer, BreadcrumbList.
- Publisher / média : qualité d'article, crédentials d'auteur, citation de sources, fraîcheur ; schema Article, NewsArticle, Person.
- Agence / services : études de cas, démonstration d'expertise, leadership d'opinion ; schema Organization, Service, Person, Review.`;

/**
 * Mapping méthodologie → parties du dashboard got_the_ref, avec garde-fous.
 * Indique à Opus QUELLE note/conclusion produire pour CHAQUE bloc d'UI, et ce
 * qu'il ne doit PAS faire (honnêteté, pas d'invention, fallback null).
 */
export const DASHBOARD_MAPPING = `MAPPING VERS LE DASHBOARD — produis une note et des conclusions pour CHAQUE bloc, avec ces garde-fous :
- categories[] : les 6 notes ci-dessus (0-100) + résumé + 2-4 constats factuels appuyés UNIQUEMENT sur les données techniques mesurées fournies. N'invente pas un bon score structuredData si aucun JSON-LD n'est détecté.
- recommendations[] : 5-8 actions priorisées (critique/haute/moyenne/basse selon la grille de sévérité) avec impact 1-10 et la catégorie concernée. Chaque reco doit découler d'un constat réel.
- engines[] : ESTIMATION par moteur (ChatGPT, Gemini) — score GEO propre, position estimée, visibilité, concurrents probables. NB : la position réelle sera remplacée par une MESURE via les API moteurs quand disponible ; reste honnête sur l'estimation.
- googleSeo : mini-audit SEO Google classique (score, positionnement organique estimé, mots-clés cibles, constats).
- webPresence : notoriété éditoriale hors-site — qualifications/labels/distinctions RÉELS et plausibles (guides, certifications, prix), apparitions presse plausibles. Liste VIDE si rien de crédible. N'invente JAMAIS une distinction invraisemblable.
- localRankings : top 10 concurrents local (niche + général) UNIQUEMENT si commerce physique avec localisation. Ce sont des ESTIMATIONS basées sur ta connaissance des acteurs réels, jamais des données mesurées.
- mapsCoherence : cohérence fiche Google Maps ↔ site SI une fiche est fournie, sinon null. Mets reviewCount/rating à null si tu ne peux pas les connaître de façon fiable (pas d'invention de chiffres).
- aiSimulation : requête naturelle type + probabilité d'apparition + concurrents devant.
- verdict : une phrase de synthèse percutante sur la visibilité IA actuelle.
RÈGLE D'OR : préfère un score bas honnête et un « null » à une donnée inventée. Chaque conclusion doit être traçable aux signaux fournis ou à une estimation explicitement prudente.`;
