/**
 * Plans, quotas et mapping Stripe.
 * Données numériques / techniques uniquement — les libellés sont dans l'i18n.
 */

/**
 * Ce que porte la colonne `User.plan`.
 *
 * Deux d'entre eux ne correspondent à aucun abonnement Stripe : `boost`, posé
 * par le paiement unique du Coup de Boost, et `demo`, posé à la main sur les
 * comptes de démonstration — ils voient tout sans rien payer. La table des
 * droits, elle, vit dans `constants/access.ts` : ici on ne décrit que les
 * offres et leurs tarifs.
 */
export type PlanKey = "free" | "boost" | "pro" | "agency" | "demo";

/** Offres vendues comme abonnement Stripe récurrent. */
export type PaidPlanKey = "pro" | "agency";

export const PLAN_KEYS: readonly PlanKey[] = [
  "free",
  "boost",
  "pro",
  "agency",
  "demo",
] as const;

export const PAID_PLAN_KEYS: readonly PaidPlanKey[] = ["pro", "agency"] as const;

/**
 * Tarif affiché par plan (donnée chiffrée, hors i18n).
 * `recurring: true` = abonnement mensuel.
 * `amount: null` = pas de prix public.
 */
export const PLAN_PRICING: Record<PlanKey, { amount: number | null; recurring: boolean }> = {
  free: { amount: 0, recurring: true },
  /** Coup de Boost : une passe des agents, payée une seule fois. */
  boost: { amount: 49, recurring: false },
  /** Offre unique : abonnement mensuel, accès total à got_the_ref. */
  pro: { amount: 79, recurring: true },
  /** Ancien plan agence : conservé pour les comptes existants, plus commercialisé. */
  agency: { amount: null, recurring: true },
  /** Compte de démonstration : accès complet, rien à facturer. */
  demo: { amount: 0, recurring: false },
};

/** Prix public de l'abonnement got_the_ref, en euros par mois. */
export const SUBSCRIPTION_PRICE = PLAN_PRICING.pro.amount as number;

/**
 * « Coup de Boost » : l'offre ponctuelle, posée à côté de l'abonnement. Une
 * seule passe des agents — mesure, corrections, articles — payée une fois, puis
 * plus rien. Aucune remesure dans la durée : c'est la frontière avec
 * l'abonnement, et elle est annoncée sur la carte.
 */
export const BOOST = {
  /** Prix public, en euros, débité une seule fois. */
  price: PLAN_PRICING.boost.amount as number,
  /** Articles rédigés pendant la passe — le seul volume promis. */
  articles: 10,
  /**
   * Variable d'environnement portant le tarif Stripe de l'offre. Ce tarif doit
   * être **ponctuel** : le checkout s'ouvre en `mode: "payment"`, qui refuse un
   * tarif récurrent.
   */
  env: "STRIPE_PRICE_BOOST",
} as const;

/**
 * Il n'y a plus d'essai gratuit.
 *
 * Ce qui en tenait lieu — regarder le produit avant de payer — est désormais le
 * compte gratuit lui-même : on ouvre un compte, on donne l'adresse de son site,
 * et le tableau de bord s'ouvre avec sa mesure, un classement et une correction
 * de contenu (cf. `constants/access.ts`). Rien à résilier, rien à débiter, et
 * aucune date d'expiration à surveiller — donc plus de `trial_period_days` sur
 * les checkouts Stripe.
 */

/**
 * Tarif mensuel de l'abonnement engagé à l'année. Toujours affiché **par mois**
 * (jamais le total annuel) : c'est la seule unité que le visiteur compare d'un
 * onglet à l'autre.
 *
 * Le price Stripe correspondant est facturé une seule fois par an
 * (`YEARLY_TOTAL_PRICE`) : les deux montants doivent rester cohérents.
 */
export const YEARLY_MONTHLY_PRICE = 59;

/** Montant réellement débité, une fois par an, pour l'engagement annuel. */
export const YEARLY_TOTAL_PRICE = YEARLY_MONTHLY_PRICE * 12;

/** Remise de l'engagement annuel, arrondie à l'entier (badge de l'onglet). */
export const YEARLY_DISCOUNT_PCT = Math.round(
  (1 - YEARLY_MONTHLY_PRICE / SUBSCRIPTION_PRICE) * 100,
);

/** Cycles de facturation proposés par la carte d'abonnement. */
export type BillingCycle = "monthly" | "yearly";

export const BILLING_CYCLES: readonly BillingCycle[] = ["monthly", "yearly"] as const;

/** Cycle retenu quand l'appelant n'en précise aucun (anciens liens, API). */
export const DEFAULT_BILLING_CYCLE: BillingCycle = "monthly";

/** Durée de la garantie « visibilité en progrès ou remboursé », en jours. */
export const GUARANTEE_DAYS = 90;

/**
 * Budget annuel d'une agence SEO / référencement IA classique.
 * Sert uniquement de repère comparatif sur la page tarifs.
 */
export const AGENCY_BENCHMARK_YEARLY = { min: 20000, max: 24000 } as const;

/**
 * Note maximale d'une analyse gratuite. L'aperçu ne mesure que l'architecture :
 * sans classements moteurs, sans audit éditorial et sans analyse de mots-clés, la
 * notation reste volontairement sévère — et le constat, un point de départ.
 *
 * La valeur est calée sous le seuil « correct » de l'échelle de couleurs
 * (`scoreColor`, vert à partir de 55) : aucun score de l'aperçu ne peut donc
 * s'afficher en vert.
 */
export const FREE_SCORE_CAP = 49;

/** Quotas d'analyses **gratuites** (l'aperçu partiel). `null` = illimité. */
/**
 * Ce que l'analyse gratuite ouvre, et où elle s'arrête.
 *
 * Une seule analyse gratuite, une seule fois, sur un seul site. C'est une
 * démonstration, pas un outil : un visiteur qui peut la relancer indéfiniment
 * n'a aucune raison d'ouvrir un compte, et chaque passe coûte un crawl complet
 * plus une série d'appels de modèle.
 *
 * Le comptage anonyme tient sur deux garde-fous complémentaires. Le cookie posé
 * après l'analyse est le vrai verrou : il survit au redémarrage du serveur et
 * suit le navigateur. Le quota par IP, lui, est en mémoire et disparaît au
 * redéploiement — il ne sert qu'à contenir une rafale depuis une même adresse
 * (cookie effacé, navigation privée), pas à décompter sur la durée.
 */
export const ANALYSIS_QUOTAS = {
  /** Visiteur anonyme : une analyse, puis plus rien sur cette adresse IP. */
  anon: { limit: 1, windowMs: 30 * 24 * 60 * 60 * 1000 },
  /** Compte gratuit : une analyse à vie, l'abonnement ouvre le reste. */
  free: { lifetime: 1 },
  /** Coup de Boost : la passe payée, donc la remesure qui va avec. */
  boost: { lifetime: null },
  /** Abonné : illimité. */
  pro: { lifetime: null },
  /** Ancien plan agence : illimité. */
  agency: { lifetime: null },
  /** Compte de démonstration : illimité, comme un abonné. */
  demo: { lifetime: null },
} as const;

/**
 * Le rythme de rédaction : combien d'articles les agents écrivent par semaine.
 *
 * Une limite hebdomadaire, pas mensuelle. Publier dix articles le premier jour
 * puis plus rien pendant trois semaines ne sert personne : ni le client, dont
 * le site paraît abandonné, ni les moteurs de réponse, qui reviennent lire un
 * domaine qui bouge. La fenêtre est glissante — sept jours en arrière, pas un
 * compteur remis à zéro le lundi, qui inviterait à tout consommer le dimanche.
 *
 * Une reprise compte comme une rédaction : c'est le même appel au grand modèle,
 * au même coût. Un client qui régénère cinq fois le même article a bien occupé
 * l'atelier cinq fois.
 */
export const ARTICLE_QUOTAS = {
  /** Rédactions (première passe ou reprise) par fenêtre de sept jours. */
  weekly: 3,
  /** La fenêtre, en millisecondes. */
  windowMs: 7 * 24 * 60 * 60 * 1000,
} as const;

/** Les trois éléments que l'onglet Contenu régénère séparément. */
export const ON_PAGE_ELEMENTS = ["serp", "h1", "intro"] as const;
export type OnPageElementKey = (typeof ON_PAGE_ELEMENTS)[number];

/**
 * Les réécritures on-page qu'un abonné peut redemander dans la journée.
 *
 * Trois par élément et par jour : de quoi essayer une autre formulation sans
 * transformer le bouton en machine à jeter des appels au modèle. Le compteur
 * est par élément — trois essais sur le H1 ne ferment pas le paragraphe — et
 * repart à zéro à minuit, heure de Paris, celle que le client lit à sa montre.
 */
export const ON_PAGE_REWRITE_QUOTA = {
  /** Passes par élément et par jour. */
  daily: 3,
  /** Le fuseau qui décide où commence la journée. */
  timeZone: "Europe/Paris",
} as const;

/**
 * Le nom du cookie qui retient l'analyse gratuite déjà consommée.
 *
 * Il porte l'identifiant de l'analyse, pas un simple drapeau : le visiteur qui
 * revient est ainsi renvoyé sur SON rapport plutôt que sur un refus sec.
 */
export const FREE_ANALYSIS_COOKIE = "visia_free_audit";

/** Durée de vie du cookie d'analyse gratuite, en secondes (un an). */
export const FREE_ANALYSIS_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Mode de facturation Stripe d'une offre. */
export type BillingMode = "payment" | "subscription";

/**
 * Facturation par offre payante : mode Stripe + variables d'environnement.
 * Une variable peut contenir un Price ID (`price_…`) **ou** un Product ID (`prod_…`) —
 * dans ce dernier cas, on résout le `default_price` du produit (cf. `resolvePriceId`).
 *
 * `envByCycle` donne un price par cycle de facturation : c'est ce qui permet aux
 * onglets mensuel / annuel de la carte tarif de partir sur deux prices distincts.
 * Une offre sans déclinaison annuelle retombe sur `env`.
 *
 * ⚠️ Ces prices doivent être **récurrents** côté Stripe : le checkout s'ouvre en
 * `mode: "subscription"`, qui refuse un tarif ponctuel.
 */
export const PLAN_BILLING: Record<
  PaidPlanKey,
  { mode: BillingMode; env: string; envByCycle?: Record<BillingCycle, string> }
> = {
  /** Abonnement got_the_ref : accès total, au mois ou à l'année. */
  pro: {
    mode: "subscription",
    env: "STRIPE_PRICE_PRO_MONTHLY",
    envByCycle: {
      monthly: "STRIPE_PRICE_PRO_MONTHLY",
      yearly: "STRIPE_PRICE_PRO_YEARLY",
    },
  },
  /** Ancien plan agence : conservé pour les abonnements déjà en cours. */
  agency: { mode: "subscription", env: "STRIPE_PRICE_AGENCY" },
} as const;

/** Nom de la variable d'environnement portant le price d'une offre, par cycle. */
export function stripePriceEnvName(
  plan: PaidPlanKey,
  cycle: BillingCycle = DEFAULT_BILLING_CYCLE,
): string {
  const billing = PLAN_BILLING[plan];
  return billing.envByCycle?.[cycle] ?? billing.env;
}

/** Rétro-compat : noms des variables d'environnement Stripe par offre payante. */
export const STRIPE_PRICE_ENV: Record<PaidPlanKey, string> = {
  pro: PLAN_BILLING.pro.env,
  agency: PLAN_BILLING.agency.env,
} as const;

/** Valeur brute de l'env d'une offre (Price ID ou Product ID), côté serveur. */
export function stripePriceEnvValue(
  plan: PaidPlanKey,
  cycle: BillingCycle = DEFAULT_BILLING_CYCLE,
): string | undefined {
  return process.env[stripePriceEnvName(plan, cycle)];
}

/** Statuts d'abonnement Stripe considérés comme actifs. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

/**
 * L'abonnement donne-t-il accès au tableau de bord ?
 *
 * Abonné ou en essai, c'est oui — et c'est la même question partout : la home
 * y décide du libellé de son bouton, l'authentification de sa destination.
 */
export function hasActiveSubscription(
  subscription: { status: string } | null | undefined,
): boolean {
  return (
    subscription != null &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status)
  );
}
