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
| `CRAWL4AI_URL` / `CRAWL4AI_TOKEN` | Service de crawl (`http://localhost:11235` par défaut) |
| `CRAWL_KEEP_HTML` | `true` pour conserver aussi le HTML brut de chaque page |
| `CRAWL_MAX_AGE_HOURS` | Fraîcheur d'un crawl avant de le relancer (168 h par défaut) |

## Tunnel d'accueil et crawl

Après un paiement ou l'ouverture d'un essai, le client passe par sept questions
(`/accueil`) avant d'atteindre son tableau de bord : type de commerce, site et
fiche Google Maps, marché et villes, activité, concurrents, tonalité, Search
Console. Les trois dernières se passent d'un clic.

Le crawler est un service à part. Sans lui, l'application retombe sur un parcours
interne réduit (une page, ses liens de même origine) : le tunnel reste
traversable, la matière est simplement plus maigre.

```bash
docker compose -f docker-compose.crawl4ai.yml up -d
curl http://localhost:11235/health
```

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

- `http://localhost:3000/api/gsc/callback` (développement)
- `https://votre-domaine.fr/api/gsc/callback` (production)

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
