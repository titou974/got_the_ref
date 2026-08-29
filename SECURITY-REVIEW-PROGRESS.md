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

## Prochaine étape

**Étape 3 — Composants client, formulaires, fuites dans les payloads RSC**

- `src/components/**` : `UrlAnalyzeForm`, `AuthForm`, `PostCheckoutAccountForm`,
  `AnalysisCheckoutButton`, `CheckoutButton`, `BillingPortalButton`.
- Vérifier ce que les Server Components sérialisent vers le client (payload RSC)
  sur `/analyse/[id]` et `/compte` : champs de `prisma.analysis` non nécessaires
  (`guestEmail`, `stripeSessionId`, `userId`) éventuellement embarqués.
- `src/app/global-error.tsx`, `not-found.tsx` : fuite d'information sur erreur.
- Gestion des états d'erreur `next-safe-action` côté client.

Étapes suivantes prévues :

- Étape 4 — Configuration Better Auth (durée de session, vérification d'e-mail,
  réinitialisation de mot de passe), CSP à nonce via middleware, `scripts/`,
  `pgtest.mjs`.
- Étape 5 — Dépendances, configuration de déploiement, relecture finale.
