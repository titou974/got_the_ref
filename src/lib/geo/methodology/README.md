# Méthodologie GEO — source de vérité de l'audit

Ce dossier **vendorise** la méthodologie des skills Claude Code `geo-audit` et `geo`
(`~/.claude/skills/geo-audit/SKILL.md` et `~/.claude/skills/geo/SKILL.md`), adaptée à
la structure du dashboard GEOBoost.

> **Pourquoi vendoriser ?** Les *skills* Claude Code s'exécutent dans l'environnement
> de l'agent, pas dans les fonctions serverless Next.js déployées. Pour que l'audit
> en production suive exactement la même grille, on copie la méthodologie ici et on
> l'injecte dans le prompt Claude (`methodology.ts`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `geo-audit.md` | Copie fidèle du skill `geo-audit` (grille 6 catégories, pondérations, sévérités, ajustements par type de commerce). |
| `geo.md` | Copie (analyse uniquement) du skill `geo` (logique d'orchestration, détection de type, scoring). |
| `../methodology.ts` | Version **prête pour le prompt** (FR, condensée) injectée dans l'appel Opus 4.8, + mapping vers chaque partie du dashboard. |

## Architecture d'analyse (GEOBoost)

1. **Étape 1 — Détection de la niche (Claude Sonnet 4.6)** : déterminée *en tout premier*
   car elle est le pivot des recherches de concurrents (top 10 OpenAI/Gemini).
2. **Classement réel (API OpenAI + Gemini)** : requête « top 10 » grand public bâtie sur
   la niche détectée → position MESURÉE.
3. **Étape 2 — Audit complet (Claude Opus 4.8)** : produit toutes les notes et conclusions
   de chaque partie du dashboard, en suivant la grille `geo-audit` ci-jointe.

Le classement provient des API moteurs ; **tout le reste** (notes des 6 catégories,
recommandations, webPresence, googleSeo, cohérence Maps, verdict) provient de l'audit Opus.
