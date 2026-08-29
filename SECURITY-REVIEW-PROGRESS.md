# Revue de sécurité — journal d'avancement

Revue complète de l'application, menée par étapes successives (une étape toutes
les 2 h). Ce fichier est le point de reprise : lire la section « Prochaine
étape » avant de recommencer quoi que ce soit.

Branche de travail : `worktree-security-review-loop`.

---

## Étape 1 — 2026-08-29 · Authentification, facturation, surface HTTP

### Périmètre couvert

- `src/features/auth/*` (Better Auth, actions signin/signup/signout, schémas Zod)
- `src/lib/safe-action.ts` (clients d'action, garde d'authentification et d'abonnement)
- `src/features/billing/*` (checkout Stripe, jeton de revendication, déblocage)
- `src/app/api/*` (analyse, webhook Stripe, proxy de capture d'écran)
- `src/app/analyse/[id]`, `src/app/compte`, `src/app/paiement/succes`
- `src/lib/geo/fetcher.ts` (anti-SSRF), `src/lib/rate-limit.ts`, `src/lib/prisma.ts`
- Recherche globale : `dangerouslySetInnerHTML`, `$queryRaw`, `eval`, `child_process`, `process.env`

### Constats et correctifs appliqués

| # | Sévérité | Fichier | Constat | Correctif |
|---|----------|---------|---------|-----------|
| 1 | Moyenne | `src/features/billing/unlock.ts` | L'e-mail de la session Stripe (saisi librement par le payeur dans le formulaire Checkout) servait à écraser le `stripeCustomerId` d'un compte existant. Un tiers pouvait donc payer en saisissant l'e-mail d'une victime et détourner le portail de facturation de celle-ci vers son propre client Stripe, avec dérive du plan (`syncSubscription` résout l'utilisateur par `stripeCustomerId`). | Le `stripeCustomerId` n'est écrasé que si l'identité est prouvée par nos propres métadonnées serveur (`metadata.userId`). Sinon, écriture seulement si le compte n'en a pas encore (`updateMany` conditionnel). |
| 2 | Moyenne | `src/lib/rate-limit.ts` | `clientIp()` lisait la **première** entrée de `X-Forwarded-For`, contrôlée par le client : IP neuve à chaque requête, donc contournement du quota anonyme d'analyse (coût direct : appels Claude / moteurs) et du débit du proxy de capture. | Priorité aux en-têtes posés par la plateforme (`x-vercel-forwarded-for`, `x-real-ip`), sinon **dernière** entrée de la chaîne `X-Forwarded-For`. |
| 3 | Faible | `next.config.ts` | Aucun en-tête de sécurité : pas de protection clickjacking, pas de HSTS, pas de `nosniff`, référent complet en sortie. | Ajout de `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, et `poweredByHeader: false`. |
| 4 | Faible | `src/app/agence/page.tsx` | JSON-LD injecté via `dangerouslySetInnerHTML` sans échappement : un `</script>` présent dans un texte de traduction fermerait la balise. | Échappement de `<` en `<`. |

### Points vérifiés — pas de correctif nécessaire

- Webhook Stripe : signature vérifiée via `constructEvent` avant tout traitement.
- Proxy `/api/screenshot` : hôtes privés refusés, protocole et port bornés, URL
  obligatoirement présente en base — pas d'open proxy.
- Anti-SSRF de `collectSignals` : résolution DNS et revalidation à **chaque**
  saut de redirection, redirections suivies manuellement.
- Rapport verrouillé : seules les données du palier gratuit sont sérialisées en
  base ; l'audit payant (`ensurePaidAnalysis`) ne tourne qu'après déblocage. Le
  floutage CSS ne masque donc pas du contenu payant.
- Revendication de paiement : cookie `httpOnly` + comparaison en temps constant
  (`timingSafeEqual`), l'identifiant de session Stripe seul ne suffit pas.
- Aucune requête SQL brute, aucun `eval`, aucun `child_process`.
- Toutes les clés d'API restent côté serveur (aucune fuite en `NEXT_PUBLIC_`).
- Pages `/compte` et actions `authActionClient` : requêtes bornées par `userId`.

### Points ouverts (à trancher, non corrigés)

- **Rebinding DNS** sur `assertPublicHost` : la résolution de contrôle et celle
  de `fetch` sont deux résolutions distinctes. Correctif réel = agent HTTP
  personnalisé épinglant l'IP validée. Coût élevé, risque faible.
- **CSP `script-src`** absente : demanderait un nonce par requête via un
  middleware. À évaluer à l'étape 4.
- `id` d'analyse en `cuid()` (v1, ~41 bits d'aléa) : un rapport payé est
  accessible à qui détient le lien, par conception. Passer à `cuid(2)` si l'on
  veut un vrai secret d'URL.

---

## Étape 2 — 2026-08-29 · Moteur d'analyse et traitement des entrées

### Périmètre couvert

- `src/lib/geo/analyzer.ts` : construction des prompts, `extractJson`, appels Claude
- `src/lib/geo/providers.ts` : appels OpenAI / Gemini, parsing des citations
- `src/lib/geo/maps.ts` : validation et scraping du lien Google Maps
- `src/lib/geo/hydrate.ts`, `diagnostic.ts`, `free-report.ts`, `solution-prompts.ts`, `methodology.ts`
- Recherche globale : tous les `fetch(` du dépôt, tous les `href={` dynamiques

### Constats et correctifs appliqués

| # | Sévérité | Fichier | Constat | Correctif |
|---|----------|---------|---------|-----------|
| 5 | Moyenne | `src/lib/geo/maps.ts` | `scrapeMapsListing` appelait `fetch` en `redirect: "follow"` après un simple `assertPublicUrl` sur l'URL de départ. Or les hôtes autorisés incluent des raccourcisseurs (`goo.gl`, `maps.app.goo.gl`, `g.co`) : seul le premier hôte était validé, la cible de redirection ne l'était pas. Un hôte autorisé redirigeant vers `169.254.169.254` ou une adresse privée atteignait le réseau interne, avec exfiltration partielle via `og:title` / `<title>` remontés dans le rapport. | Passage par `safeFetch`, qui suit les redirections manuellement et revalide schéma + hôte à **chaque** saut. `safeFetch` est désormais exporté et accepte en-têtes et budget de temps personnalisés. |

### Points vérifiés — pas de correctif nécessaire

- Tous les `fetch` restants visent un hôte fixe (`api.apiflash.com`,
  `api.openai.com`, `generativelanguage.googleapis.com`) ou passent par `safeFetch`.
- Les seuls `href` dynamiques sont `result.url` (forcé en http(s) par
  `normalizeUrl`) et `mapsUrl` (liste blanche d'hôtes Google) : pas de
  `javascript:` possible. Aucun rendu de citation en lien cliquable.
- Le champ `error` des moteurs (`LiveEngineResult.error`) n'appartient pas aux
  types persistés : les corps d'erreur amont ne remontent jamais au navigateur.
- La clé Gemini voyage en query string vers Google uniquement ; `postJson` ne
  journalise que l'hôte, jamais l'URL complète.
- Aucun rendu HTML brut de sortie de modèle : tout passe par l'échappement React.
- Le palier `free` n'appelle ni Claude ni les moteurs : un visiteur non payant ne
  déclenche aucun coût, et `ensurePaidAnalysis` est idempotent (`tier === "paid"`).

### Point ouvert

- **Injection de prompt** depuis le contenu du site audité : le texte scrapé
  alimente les prompts Claude/OpenAI/Gemini. Impact borné (le résultat est du
  texte affiché, échappé par React, sans appel d'outil privilégié), mais un site
  malveillant peut fausser son propre rapport. Pas de correctif prévu.

---

## Étape 3 — 2026-08-29 · Composants client, formulaires, exposition des rapports

### Périmètre couvert

- `src/components/UrlAnalyzeForm.tsx`, `PostCheckoutAccountForm.tsx`,
  `AnalysisCheckoutButton.tsx`, `CheckoutButton.tsx`, `BillingPortalButton.tsx`
- Payload RSC de `/analyse/[id]` et `/compte` : ce qui franchit réellement la
  frontière serveur → client
- `src/app/global-error.tsx`, `not-found.tsx`, `src/app/tarifs/page.tsx`
- Indexation : `robots.txt`, directives `robots` des métadonnées

### Constats et correctifs appliqués

| # | Sévérité | Fichier | Constat | Correctif |
|---|----------|---------|---------|-----------|
| 6 | Moyenne | `src/app/analyse/[id]/page.tsx` | Aucune directive `robots` sur la page de rapport. Or un rapport payé n'est protégé que par son lien : indexé, il devient une page publique, et l'audit d'un client se retrouve dans les résultats de recherche (nom, domaine, score, verdict, et le rapport complet une fois débloqué). | `robots: { index: false, follow: false }` dans `generateMetadata`, y compris sur le cas « analyse introuvable ». |
| 7 | Moyenne | `src/app/robots.ts` (nouveau) | Aucun `robots.txt` : les crawlers étaient libres d'explorer `/analyse/`, `/compte`, `/paiement/` et `/api/`. | Ajout d'un `robots.ts` : vitrine ouverte, `Disallow` sur `/analyse/`, `/compte`, `/paiement/`, `/api/`. |
| 8 | Faible | `src/lib/rate-limit.ts` | Correction de l'étape 1 : `x-real-ip` était consulté **avant** `X-Forwarded-For`. Or un client peut envoyer `x-real-ip` lui-même ; seul un proxy qui l'écrase le rend fiable. Sur un hébergement qui ne le pose pas, le contournement de quota restait ouvert. | Ordre de confiance décroissante : `x-vercel-forwarded-for`, puis dernière entrée de `X-Forwarded-For`, puis `x-real-ip` en dernier recours. |

### Points vérifiés — pas de correctif nécessaire

- `/analyse/[id]` : `loadAnalysis` ne renvoie que `result`, `unlocked`, `userId`.
  `guestEmail`, `stripeSessionId` et `paidAt` ne quittent jamais le serveur.
- `/compte` : l'historique est rendu intégralement côté serveur, aucune ligne
  `prisma.analysis` n'est sérialisée dans le payload RSC.
- `global-error.tsx` : affiche le seul `error.digest`, jamais le message ni la pile.
- `AnalysisCheckoutButton` : le `window.location.href` reçoit une URL produite
  par le serveur (Stripe ou `SITE.url`), jamais une valeur du client.
- `PostCheckoutAccountForm` : l'e-mail est en lecture seule et l'action serveur
  le relit depuis la session Stripe — le champ du formulaire n'est pas de
  confiance et n'est d'ailleurs pas transmis.
- `tarifs?analyse=<id>` : le paramètre n'est qu'un identifiant transmis à une
  action serveur qui le valide contre la base.

---

## Étape 4 — 2026-08-30 · Better Auth, CSP, scripts hors application

### Périmètre couvert

- `src/features/auth/better-auth.config.ts`, `src/app/api/auth/[...all]/route.ts`
- `prisma.config.ts`, `pgtest.mjs`, `scripts/gen-lottie.mjs`
- `README.md` : valeurs sensibles éventuellement publiées
- Faisabilité d'une CSP `script-src` à nonce

### Constats et correctifs appliqués

| # | Sévérité | Fichier | Constat | Correctif |
|---|----------|---------|---------|-----------|
| 9 | **CRITIQUE** | `pgtest.mjs` (supprimé) | Mot de passe de la base Supabase de production **en clair dans le dépôt**, avec la référence de projet et les deux noms d'hôte (pooler et direct). Committé dans `1cee1d4`, présent sur `origin/main` et sur une cinquantaine de branches poussées. Accès complet en lecture/écriture à la base : comptes, e-mails, abonnements, analyses. Le script désactivait par ailleurs la vérification du certificat TLS (`rejectUnauthorized: false`). | Fichier supprimé. **Insuffisant à lui seul** : le secret reste dans l'historique Git et sur le remote. Rotation du mot de passe Supabase requise (action propriétaire, cf. ci-dessous). |

### Suites à donner par le propriétaire du dépôt (non automatisables)

1. Réinitialiser le mot de passe de la base dans Supabase (Settings → Database →
   Reset database password), puis mettre à jour `DATABASE_URL` et `DIRECT_URL`
   chez l'hébergeur.
2. Relire les journaux de connexion Supabase à la recherche d'accès inattendus.
3. Trancher sur le nettoyage de l'historique Git (réécriture + push forcé sur
   toutes les branches, ou dépôt neuf). Opération destructive, à décider
   explicitement.

### Points vérifiés — pas de correctif nécessaire

- `secret` Better Auth : la bibliothèque lève une erreur au démarrage en
  production si aucune variable de secret n'est définie — pas de repli silencieux
  sur le secret de développement.
- `trustedOrigins` implicite : par défaut la `baseURL`, ce qui est correct ici.
- Cookies de session : `httpOnly`, `secure` en production, `sameSite: lax`.
- `cookieCache` de 5 min : une session révoquée peut rester acceptée jusqu'à
  5 minutes. Compromis assumé et borné, pas une faille.
- `README.md` : ne publie que des noms de variables, aucune valeur.
- `prisma.config.ts` et `scripts/gen-lottie.mjs` : chemins fixes, aucune entrée
  utilisateur, aucune commande shell.
- `api/auth/[...all]` : simple délégation à `toNextJsHandler(auth)`, sans
  traitement maison.

### Points ouverts

- **Vérification d'e-mail absente** (aucun fournisseur d'e-mail branché). Chemin
  concret : un attaquant enregistre à l'avance un compte avec l'e-mail d'un
  prospect connu ; quand ce prospect paie une analyse en saisissant cet e-mail
  chez Stripe, `unlockAnalysisFromSession` retrouve le compte par e-mail et lui
  rattache le rapport payé. Corriger en gardant le rattachement par e-mail réservé
  aux comptes vérifiés — impossible tant que l'envoi d'e-mails n'est pas en place
  (une branche `worktree-resend-password-reset` existe). À reprendre à ce
  moment-là.
- **CSP `script-src` à nonce** : évaluée, non appliquée. Elle demande un
  middleware qui pose un nonce par requête et le propage jusqu'au `<script>` de
  Next ; sans possibilité de faire tourner l'application ici, le risque de casser
  le rendu (styles inline de framer-motion, scripts injectés par Next) l'emporte
  sur le gain. `frame-ancestors` reste en place depuis l'étape 1.

---

## Prochaine étape

**Étape 5 — Dépendances, déploiement, relecture finale**

- 44 alertes Dependabot annoncées au push sur la branche par défaut (21 hautes,
  20 modérées, 3 basses) : établir la liste réelle via `npm audit`, distinguer ce
  qui est atteignable en production de ce qui ne l'est qu'en outillage de build,
  appliquer les montées de version sûres.
- Vérifier que `next` 16.2.9, `better-auth`, `stripe` et `prisma` sont sur des
  versions sans avis de sécurité connu.
- Relecture finale : reprendre les points ouverts des étapes 1 à 4 et statuer.
