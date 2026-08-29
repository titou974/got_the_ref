# BoostGEO

Plateforme SaaS d'analyse **GEO** (Generative Engine Optimization) et **SEO**. Mesure la visibilité d'un site dans les moteurs de recherche IA (ChatGPT, Perplexity, Gemini) et sur Google, avec un score global, des scores par moteur, un positionnement estimé et des recommandations générées par l'IA Claude.

## Stack (100 % gratuite en local)

| Brique | Techno |
|--------|--------|
| Framework | Next.js 16 (App Router, Server Actions, routes `/api`) |
| UI | React 19 + Tailwind CSS v4 + Framer Motion + Recharts |
| Base de données | SQLite via Prisma 6 |
| Authentification | Maison — JWT (`jose`) en cookie httpOnly + `bcryptjs` |
| Analyse IA | API Claude (`@anthropic-ai/sdk`, modèle `claude-opus-4-8`) |
| Paiement | Stripe (Checkout + Billing Portal + Webhooks) |

> Sans clé API Claude, l'analyse bascule automatiquement sur un **moteur heuristique** déterministe : l'application reste pleinement fonctionnelle pour la démo.

## Installation

```bash
npm install                 # installe + génère le client Prisma
cp .env.example .env        # puis remplir les variables
npm run db:push             # crée la base SQLite (prisma/dev.db)
npm run dev                 # http://localhost:3000
```

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Connexion SQLite (`file:./dev.db` par défaut) |
| `AUTH_SECRET` | Secret de signature des sessions JWT (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Connexion Google (facultatif — sans eux, le bouton Google n'est pas affiché) |
| `ANTHROPIC_API_KEY` | Clé API Claude (optionnelle — fallback heuristique sinon) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_AGENCY` | IDs de prix (abonnements mensuels) |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app |
| `AI_PROVIDER` | `deepseek` (défaut) ou `moonshot` : qui mène sur le tunnel d'accueil |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | DeepSeek V4 Flash (`deepseek-v4-flash` par défaut) |
| `MOONSHOT_API_KEY` / `MOONSHOT_MODEL` | Kimi (`kimi-k2.6` par défaut), fournisseur de secours |
| `FIRECRAWL_API_KEY` | Clé Firecrawl (sans elle, repli sur le parcours interne) |
| `FIRECRAWL_URL` | Instance Firecrawl auto-hébergée (`https://api.firecrawl.dev` par défaut) |
| `CRAWL_KEEP_HTML` | `true` pour conserver aussi le HTML brut de chaque page |
| `CRAWL_MAX_AGE_HOURS` | Fraîcheur d'un crawl avant de le relancer (168 h par défaut) |
| `CREDENTIALS_KEY` | Phrase secrète (32 caractères minimum) qui chiffre les identifiants de plateforme du tableau de bord. Sans elle, le rattachement d'un site est refusé. |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Mots-clés tendances relevés avec la recherche Google (`gemini-flash-latest` par défaut) |
| `RESEND_API_KEY` | Clé Resend pour les e-mails transactionnels (sans elle, les envois sont journalisés en console) |
| `RESEND_FROM` | Expéditeur, ex. `got_the_ref <bonjour@votre-domaine.fr>` (`onboarding@resend.dev` par défaut) |
| `RESEND_REPLY_TO` | Adresse de réponse (par défaut, le contact du site) |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Identifiants DataForSEO ([api-access](https://app.dataforseo.com/api-access)) pour le relevé des mentions dans les IA. Sans eux, la carte reste en mode exemple. |
| `DATAFORSEO_AUTH` | Variante à variable unique : base64 de `login:password` |

## Tunnel d'accueil et crawl

Après un paiement ou l'ouverture d'un essai, le client passe par sept questions
(`/accueil`) avant d'atteindre son tableau de bord : type de commerce, site et
fiche Google Maps, marché et villes, activité, concurrents, tonalité, Search
Console. Les trois dernières se passent d'un clic.

Le crawl passe par Firecrawl, un service hébergé appelé en HTTP : rien à faire
tourner à côté de l'application, qui reste déployable telle quelle sur une
plateforme sans conteneurs. Une page crawlée coûte un crédit, et l'étape « site »
en consomme jusqu'à 25 par client.

Renseignez `FIRECRAWL_API_KEY` et c'est tout. Sans clé, l'application retombe sur
un parcours interne (fetch + cheerio, liens de même origine) : le tunnel reste
traversable, mais les sites qui s'affichent en JavaScript ressortent vides.

Chaque page crawlée est conservée en base (`CrawledSite` / `CrawledPage`),
indexée par domaine : deux clients sur le même domaine partagent le crawl, et un
recrawl remplace le jeu de pages plutôt que de le compléter.

Deux modèles lisent ensuite ce contenu, tous deux en API compatible OpenAI :
DeepSeek V4 Flash mène (le moins cher au token), Kimi prend le relais si le
premier échoue. Sans aucune clé, les étapes qui dépendent d'un modèle
(détection de la langue et des villes, liste des concurrents, lecture de la
tonalité) restent vides sans interrompre le parcours.

### Étape Search Console

Le rattachement Search Console réutilise les identifiants OAuth de la connexion
Google, avec son propre consentement (`webmasters.readonly`, lecture seule).
Ajoutez la seconde URI de redirection dans Google Cloud :

- `http://localhost:3000/api/google/callback` (développement)
- `https://votre-domaine.fr/api/google/callback` (production)

## Connexion Google (facultative)

Tant que `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont absents, le fournisseur
n'est pas déclaré et le bouton « S'inscrire avec Google » n'apparaît pas : les
pages d'inscription et de connexion ouvrent alors directement le formulaire
e-mail. Pour l'activer :

1. Google Cloud Console → **APIs & Services** → **Credentials** → **Create
   credentials** → **OAuth client ID** → **Web application**.
2. Renseignez les URI de redirection autorisées :
   - `http://localhost:3000/api/auth/callback/google` (développement)
   - `https://votre-domaine.fr/api/auth/callback/google` (production)
3. Reportez le Client ID et le Client Secret dans `.env`.

L'URL de rappel est dérivée de `baseURL` (soit `NEXT_PUBLIC_APP_URL`) : si elle
ne correspond pas à l'URI déclarée chez Google, l'échange échoue en
`redirect_uri_mismatch`.

## Mot de passe oublié (Resend)

Le parcours tient en deux pages : `/mot-de-passe-oublie` (saisie de l'adresse)
et `/nouveau-mot-de-passe` (atterrissage du lien reçu, jeton dans l'URL). Better
Auth émet et vérifie le jeton, valable **une heure** ; l'e-mail part par Resend
depuis `sendResetPassword`, différé après la réponse via `after()` de Next.

Pour l'activer :

1. Créez une clé sur [resend.com/api-keys](https://resend.com/api-keys) →
   `RESEND_API_KEY`.
2. Vérifiez votre domaine sur [resend.com/domains](https://resend.com/domains)
   (enregistrements DKIM/SPF), puis renseignez `RESEND_FROM` avec une adresse de
   ce domaine. Sans domaine vérifié, `onboarding@resend.dev` n'expédie qu'à
   l'adresse du compte Resend — bon pour un essai, pas pour la production.

Sans `RESEND_API_KEY`, rien ne casse : la demande aboutit, l'e-mail est
journalisé en console (`[email] RESEND_API_KEY absente …`) au lieu d'être
expédié — et le lien reste lisible dans ce journal pour tester en local.

Deux garde-fous côté serveur : la réponse est identique que l'adresse existe ou
non (pas d'annuaire de clients), et le débit est bridé à 5 demandes par quart
d'heure et par IP, 3 par heure et par adresse. Une réinitialisation réussie
ferme toutes les sessions ouvertes du compte.

## Tableau de bord

`/tableau-de-bord`, ouvert une fois le tunnel d'accueil terminé. Six sections
partagent la même fiche client et la même analyse, chargées une seule fois par
requête (`features/dashboard/queries.ts`).

| Section | Ce qu'elle montre |
|---------|-------------------|
| Accueil | Place du commerce dans chaque IA, trafic amené par les assistants, note de visibilité, prochains articles |
| Contenu | Mots-clés tendances de la niche, éléments on-page actuels face à leur réécriture |
| Architecture | Contrôles techniques du dernier crawl, accès des robots d'IA, volume lu |
| Articles | Calendrier éditorial, rédaction, validation, publication, voix de la marque |
| Présence web | Mentions relevées, liens entrants, sites de la niche à contacter |
| Google Maps | Cohérence fiche ↔ site, posts préparés d'avance (commerces avec adresse) |

À la première ouverture, le compte n'a pas encore d'audit complet : la page lance
l'analyse elle-même (`prepareDashboardAction`) et se recharge quand elle est prête.

### Trafic venu des IA

Lu dans Google Analytics 4, à partir de la source de session, jamais d'un
paramètre d'URL :

- ChatGPT ajoute `?utm_source=chatgpt.com` à ses liens, GA4 range donc la visite
  sous `chatgpt.com` ;
- Perplexity n'ajoute pas d'`utm_source` (ses liens portent `?ct-referrer=perplexity`,
  qu'Analytics ignore) : la visite se reconnaît à son référent `perplexity.ai` ;
- Gemini n'ajoute rien : seul le référent `gemini.google.com` reste, et il ne
  couvre que les clics depuis l'application. Les liens des aperçus IA de Google
  partent de `google.com` et restent mêlés au référencement classique. L'interface
  le dit plutôt que de gonfler le chiffre.

### Mentions dans les IA (DataForSEO)

La carte « Mentions dans les IA » compte, modèle par modèle, les réponses d'IA où
le domaine du commerce est cité. Elle lit l'archive DataForSEO
(`/v3/ai_optimization/llm_mentions/search_mentions/live`) : des millions de
questions grand public rejouées en continu sur ChatGPT et sur les aperçus IA de
Google, réponses et sources conservées.

- Une ligne de l'archive = une réponse d'IA citant le domaine. Le décompte par
  `model_name` donne les barres du graphique ; le volume de recherche cumulé des
  questions concernées donne le second chiffre, celui qui dit si ces mentions
  pèsent quelque chose.
- Au-dessus, une seconde série : les mentions **de la marque** mois par mois sur
  douze mois, via `/v3/ai_optimization/llm_mentions/historical/live` — le nom du
  commerce en mot-clé, pas son domaine : une IA qui conseille un commerce le
  nomme bien plus souvent qu'elle ne cite son site. `timeseries_delta` a été
  écarté : il ne rend que `delta_mentions`, l'écart avec le mois précédent, pas
  le nombre. L'écart est donc recalculé d'une soustraction, ce qui économise un
  appel facturé. L'archive ne remonte pas avant **2025-08-01**, et hors
  États-Unis seul Google est historisé — la courbe porte donc sur les aperçus IA
  de Google, ce que la carte dit.
- La cible est le domaine de la fiche d'accueil, sous-domaines compris ; la
  localisation suit le pays relevé pendant l'accueil (France par défaut).
- **Un relevé par client et par jour**, tenu en base (`LlmMentionSnapshot`, une
  ligne par compte) et non par un cache : un cache s'évapore à chaque
  déploiement, la facture non. Un relevé = deux requêtes DataForSEO, le décompte
  par modèle et les douze mois de la marque ; l'historique a le droit d'échouer
  seul, une marque absente de l'archive n'emporte pas le reste de la carte. La table garde deux dates — `attemptedAt`, la
  dernière tentative réussie **ou ratée**, qui ouvre ou ferme la porte, et
  `fetchedAt`, le dernier relevé exploitable, celui que la carte affiche. Rien
  ne rouvre la porte avant l'heure, pas même un changement de domaine — sinon un
  aller-retour entre deux domaines suffirait à appeler sans limite ; le relevé
  gardé ne ressort que s'il porte sur le même domaine et la même localisation.
  Ajouter la table : `npm run db:push`.
- Le relevé est borné à trois pages de 1 000 réponses — au-delà, le total exact
  reste lu dans `total_count` et la carte signale un détail partiel.
- Sans identifiants, aucun appel ne part : la carte montre l'exemple sous voile,
  avec son bandeau « données d'exemple ».

Pour vérifier le branchement en ligne de commande — le script parle à DataForSEO
directement et ne passe pas par le compteur quotidien, chaque exécution est donc
facturée :

```bash
npm run check:dataforseo -- exemple.fr                    # France (2250) par défaut
npm run check:dataforseo -- exemple.be 2056               # autre localisation
npm run check:dataforseo -- exemple.fr 2250 "Ma Marque"   # + les 12 mois de la marque
```

### Rattachement du site

`constants/site-platforms.ts` décrit la porte d'entrée de chaque plateforme et ce
qu'elle permet vraiment : déposer un article (`publish`), corriger une page
(`edit`). WordPress, WooCommerce, Shopify et Ghost ouvrent les deux ; Wix,
Webflow, Squarespace, PrestaShop et Framer n'ouvrent pas leur rédaction à une API
tierce et n'accordent donc que la correction. Un site fait main passe par
« Autre site » avec un webhook.

Les identifiants sont chiffrés en AES-256-GCM (`lib/crypto.ts`, clé dérivée de
`CREDENTIALS_KEY`) avant d'être écrits, et ne repartent jamais vers le navigateur.

## Configuration Stripe

1. Créez deux produits récurrents (Pro 29 €/mois, Agence 99 €/mois) dans le dashboard Stripe et reportez leurs `price_…` dans `.env`.
2. Webhook local :
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copiez le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.
3. Événements gérés : `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`.

## Architecture

```
src/
├─ app/
│  ├─ page.tsx                     Landing non-scrollable (input + simulation IA animée)
│  ├─ analyse/[id]/page.tsx        Dashboard de résultats
│  ├─ connexion · inscription · compte    Authentification
│  ├─ tarifs                       Offres + Checkout Stripe
│  ├─ mentions-legales · cgv-cgu · politique-de-confidentialite
│  ├─ actions/auth.ts              Server Actions (inscription/connexion/déconnexion)
│  └─ api/
│     ├─ analyze/                  Lance une analyse GEO+SEO
│     └─ stripe/                   checkout · portal · webhook
├─ lib/
│  ├─ geo/                         Moteur d'analyse (fetcher + analyzer Claude + types)
│  ├─ auth.ts · prisma.ts · stripe.ts · score.ts
└─ components/                     Nav, Footer, formulaires, dashboard (graphiques)
```

## Modèle de scoring GEO

Pondérations issues de la méthodologie GEO :

| Catégorie | Poids |
|-----------|-------|
| Citabilité & Visibilité IA | 25 % |
| Autorité de marque | 20 % |
| Qualité du contenu & E-E-A-T | 20 % |
| Fondations techniques | 15 % |
| Données structurées | 10 % |
| Optimisation par plateforme | 10 % |

Le moteur combine des **vérifications déterministes** (HTTP, robots.txt, sitemap, llms.txt, JSON-LD, balises, accès des crawlers IA) et une **évaluation par Claude** restituée en JSON structuré.

## Quotas par formule

- **Gratuit** : 3 analyses au total
- **Pro** : 50 analyses / mois
- **Agence** : illimité
