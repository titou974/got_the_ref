# Graph Report - .  (2026-06-14)

## Corpus Check
- Corpus is ~28,608 words - fits in a single context window. You may not need a graph.

## Summary
- 389 nodes · 589 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.81)
- Token cost: 0 input · 26,403 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Landing & AI Search Simulation|Landing & AI Search Simulation]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Account, Checkout & Analysis Pages|Account, Checkout & Analysis Pages]]
- [[_COMMUNITY_Authentication & Nav UI|Authentication & Nav UI]]
- [[_COMMUNITY_Lottie Animation Generator|Lottie Animation Generator]]
- [[_COMMUNITY_Results Dataviz Components|Results Dataviz Components]]
- [[_COMMUNITY_GEO Analyzer Engine|GEO Analyzer Engine]]
- [[_COMMUNITY_URL Fetcher & SSRF Guard|URL Fetcher & SSRF Guard]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Lottie Asset (animation5)|Lottie Asset (animation5)]]
- [[_COMMUNITY_Lottie Asset (animation3)|Lottie Asset (animation3)]]
- [[_COMMUNITY_Lottie Asset (animation4)|Lottie Asset (animation4)]]
- [[_COMMUNITY_Lottie Asset (animation1)|Lottie Asset (animation1)]]
- [[_COMMUNITY_Lottie Asset (animation2)|Lottie Asset (animation2)]]
- [[_COMMUNITY_Legal Pages (CGVMentionsConfidentialité)|Legal Pages (CGV/Mentions/Confidentialité)]]
- [[_COMMUNITY_Lottie Asset (bars)|Lottie Asset (bars)]]
- [[_COMMUNITY_Lottie Asset (orbit)|Lottie Asset (orbit)]]
- [[_COMMUNITY_GEO Platform Concepts|GEO Platform Concepts]]
- [[_COMMUNITY_Root Layout & Fonts|Root Layout & Fonts]]
- [[_COMMUNITY_Auth, Billing & Data Layer|Auth, Billing & Data Layer]]
- [[_COMMUNITY_Agent Instructions & Docs|Agent Instructions & Docs]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `getCurrentUser()` - 12 edges
3. `radar()` - 11 edges
4. `sk()` - 10 edges
5. `scripts` - 9 edges
6. `orbit()` - 9 edges
7. `scoreColor()` - 9 edges
8. `bars()` - 8 edges
9. `sparkle()` - 8 edges
10. `POST()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AnalysePage()` --calls--> `NotFound()`  [INFERRED]
  src/app/analyse/[id]/page.tsx → src/app/not-found.tsx
- `CLAUDE.md Agent Instructions` --references--> `Next.js Agent Rules`  [EXTRACTED]
  CLAUDE.md → AGENTS.md
- `POST()` --calls--> `analyzeSite()`  [EXTRACTED]
  src/app/api/analyze/route.ts → src/lib/geo/analyzer.ts
- `POST()` --calls--> `getCurrentUser()`  [EXTRACTED]
  src/app/api/analyze/route.ts → src/lib/auth.ts
- `ComptePage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  src/app/compte/page.tsx → src/lib/auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GEO Analysis Flow (engine + Claude + heuristic fallback + scoring)** — readme_geo_engine, readme_claude_analysis, readme_heuristic_engine, readme_scoring_model, readme_deterministic_checks [INFERRED 0.85]
- **BoostGEO Technology Stack** — readme_nextjs, readme_prisma_sqlite, readme_auth_jwt, readme_stripe, readme_claude_analysis [INFERRED 0.75]

## Communities (25 total, 3 thin omitted)

### Community 0 - "Landing & AI Search Simulation"
Cohesion: 0.06
Nodes (32): AiSearchSimulation(), Engine, ENGINES, Phase, Scenario, SCENARIOS, AnalyzingOverlay(), Lottie (+24 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.05
Nodes (36): dependencies, @anthropic-ai/sdk, bcryptjs, cheerio, framer-motion, jose, lottie-react, next (+28 more)

### Community 2 - "Account, Checkout & Analysis Pages"
Cohesion: 0.10
Nodes (24): POST(), CheckoutButton(), Footer(), Nav(), ComptePage(), metadata, PLAN_LABEL, GeoAnalysisResult (+16 more)

### Community 3 - "Authentication & Nav UI"
Cohesion: 0.14
Nodes (21): AuthState, signIn(), signOut(), signUp(), NotFound(), Action, AuthForm(), Logo() (+13 more)

### Community 4 - "Lottie Animation Generator"
Cohesion: 0.19
Nodes (26): ak(), bars(), comp(), E1, E2, E3, EASE_I, EASE_O (+18 more)

### Community 5 - "Results Dataviz Components"
Cohesion: 0.15
Nodes (17): AnimatedCard(), AnimatedScoreRing(), CategoryRadar(), CategoryBar(), ChannelTabs(), ENGINE_FACTORS, EnginePanel(), TabKey (+9 more)

### Community 6 - "GEO Analyzer Engine"
Cohesion: 0.18
Nodes (19): analyzeSite(), analyzeWithClaude(), buildPrompt(), CATEGORY_KEYS, clamp(), computeOverall(), deriveEngine(), extractJson() (+11 more)

### Community 7 - "URL Fetcher & SSRF Guard"
Cohesion: 0.21
Nodes (16): POST(), AI_CRAWLERS, assertPublicHost(), assertPublicUrl(), BlockedUrlError, collectSignals(), ipv4IsPrivate(), ipv6IsPrivate() (+8 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "Lottie Asset (animation5)"
Cohesion: 0.11
Nodes (17): assets, ddd, fr, h, ip, layers, markers, meta (+9 more)

### Community 10 - "Lottie Asset (animation3)"
Cohesion: 0.15
Nodes (12): assets, ddd, fr, h, ip, layers, meta, g (+4 more)

### Community 11 - "Lottie Asset (animation4)"
Cohesion: 0.15
Nodes (12): assets, ddd, fr, h, ip, layers, meta, g (+4 more)

### Community 12 - "Lottie Asset (animation1)"
Cohesion: 0.17
Nodes (11): assets, ddd, fr, h, ip, layers, markers, nm (+3 more)

### Community 13 - "Lottie Asset (animation2)"
Cohesion: 0.17
Nodes (11): assets, ddd, fr, h, ip, layers, markers, nm (+3 more)

### Community 14 - "Legal Pages (CGV/Mentions/Confidentialité)"
Cohesion: 0.24
Nodes (4): metadata, LegalLayout(), metadata, metadata

### Community 15 - "Lottie Asset (bars)"
Cohesion: 0.18
Nodes (10): assets, ddd, fr, h, ip, layers, nm, op (+2 more)

### Community 16 - "Lottie Asset (orbit)"
Cohesion: 0.18
Nodes (10): assets, ddd, fr, h, ip, layers, nm, op (+2 more)

### Community 17 - "GEO Platform Concepts"
Cohesion: 0.25
Nodes (9): BoostGEO SaaS Platform, Claude AI Analysis (claude-opus-4-8), Deterministic Checks (HTTP, robots, sitemap, llms.txt, JSON-LD), Generative Engine Optimization (GEO), GEO Analysis Engine (lib/geo: fetcher + analyzer + types), Deterministic Heuristic Fallback Engine, Next.js 16 (App Router, Server Actions), GEO Scoring Model (weighted categories) (+1 more)

### Community 18 - "Root Layout & Fonts"
Cohesion: 0.40
Nodes (3): dmSans, metadata, spaceGrotesk

### Community 19 - "Auth, Billing & Data Layer"
Cohesion: 0.50
Nodes (4): JWT Auth (jose + bcryptjs, httpOnly cookie), SQLite via Prisma 6, Plan Quotas (Free/Pro/Agency), Stripe Billing (Checkout + Portal + Webhooks)

### Community 20 - "Agent Instructions & Docs"
Cohesion: 0.67
Nodes (3): Next.js Agent Rules, Next.js Bundled Docs (node_modules/next/dist/docs), CLAUDE.md Agent Instructions

## Knowledge Gaps
- **201 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `Account, Checkout & Analysis Pages` to `Authentication & Nav UI`, `URL Fetcher & SSRF Guard`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Nav()` connect `Account, Checkout & Analysis Pages` to `Landing & AI Search Simulation`, `Authentication & Nav UI`, `Legal Pages (CGV/Mentions/Confidentialité)`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `scoreColor()` connect `Results Dataviz Components` to `Account, Checkout & Analysis Pages`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Landing & AI Search Simulation` be split into smaller, more focused modules?**
  _Cohesion score 0.05668016194331984 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Account, Checkout & Analysis Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.10158730158730159 - nodes in this community are weakly interconnected._