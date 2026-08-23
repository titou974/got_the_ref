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
