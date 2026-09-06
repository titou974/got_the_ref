import "server-only";

import { prisma } from "@/lib/prisma";
import { tierAtLeast, type AccessTier } from "@/constants/access";
import { getAccess } from "@/features/billing/access";
import { detectBrandIdentity } from "@/features/onboarding/service";

/**
 * Le ton de la marque : son relevé, et son rattrapage.
 *
 * Extrait des actions du tableau de bord parce qu'il ne s'appelle plus
 * seulement depuis une action serveur : la coque du tableau de bord le
 * redemande elle-même à chaque reconnexion (cf. `backfillBrandTone`), et un
 * fichier `"use server"` n'exporte que des actions.
 *
 * Le texte lu est celui du crawl Firecrawl déjà en base (`getOrCrawlSite`), et
 * la lecture part sur le nano d'OpenAI (rôle `tone`) : c'est une extraction,
 * pas un jugement.
 */

/**
 * Le ton de la marque et sa couleur, relevés une fois, dès le premier achat.
 *
 * Cette lecture-là ne se vend pas à l'unité : elle ne sert que là où des textes
 * sortent au nom du client — les articles, les réécritures on-page, les posts.
 * Un compte gratuit n'en publie aucun, et la question ne lui est donc pas
 * posée. Dès le Coup de Boost en revanche, elle l'est : cette offre ouvre
 * l'onglet Articles et fait rédiger la première semaine dans la foulée de
 * l'achat (cf. `seedEditorialMonthAction`). Ces articles-là sont les premiers
 * textes que le client lit sous son propre nom ; les écrire sans avoir relevé
 * sa manière d'écrire revenait à les lui rendre dans la voix de personne, et
 * c'est exactement ce qui les faisait finir non publiés.
 *
 * D'où le fait qu'elle vive ici, du côté du tableau de bord, et pas dans le
 * tunnel d'accueil. Un client qui ouvre un compte gratuit puis achète trois
 * semaines plus tard ne repasse pas par l'accueil ; il repasse en revanche par
 * son tableau de bord, et le ton se relève donc au moment exact où il devient
 * utile, sans lui redemander quoi que ce soit.
 *
 * Best-effort de bout en bout : un site injoignable ou un modèle muet rend le
 * ton déjà en base (souvent `null`), et l'audit continue. Rien de ce qui est
 * ici ne vaut de faire échouer l'analyse que le client attend à l'écran.
 */
export async function ensureBrandIdentity(
  userId: string,
  tier: AccessTier,
  profile: {
    siteUrl: string | null;
    toneSummary: string | null;
    toneSampleUrl: string | null;
    brandColor: string | null;
  },
): Promise<string | null> {
  if (!tierAtLeast(tier, "boost")) return profile.toneSummary;

  // Déjà relevés : la voix d'une marque ne change pas d'une analyse à l'autre,
  // et la relire à chaque remesure serait un appel de modèle pour rien.
  if (profile.toneSummary && profile.brandColor) return profile.toneSummary;

  try {
    const brand = await detectBrandIdentity({
      siteUrl: profile.siteUrl,
      sampleUrl: profile.toneSampleUrl,
    });

    // Écriture champ par champ : une seconde passe qui ne retrouve que la
    // couleur ne doit pas effacer le ton relevé à la première.
    const data = {
      ...(brand.tone ? { toneSummary: brand.tone } : {}),
      ...(brand.color ? { brandColor: brand.color } : {}),
      ...(brand.sourceUrl ? { toneSampleUrl: brand.sourceUrl } : {}),
    };
    if (Object.keys(data).length > 0) {
      await prisma.onboardingProfile.update({ where: { userId }, data });
    }

    return brand.tone ?? profile.toneSummary;
  } catch (err) {
    console.error("Relevé du ton de marque échoué :", err);
    return profile.toneSummary;
  }
}

/**
 * Le délai avant de retenter une lecture qui n'a rien rendu.
 *
 * Une lecture qui échoue laisse le ton vide, et le compte repasse par la coque
 * à chaque navigation : sans ce garde-fou, un site injoignable déclencherait un
 * crawl et un appel de modèle à chaque clic dans le tableau de bord. Six heures
 * suffisent — le client qui vient de corriger son site le reverra le lendemain,
 * et personne n'attend le ton à la seconde.
 */
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Les tentatives déjà faites, par compte, dans cette instance.
 *
 * En mémoire à dessein : c'est un limiteur de débit, pas un état du produit. Un
 * redémarrage qui l'efface fait au pire une lecture de plus, et le champ écrit
 * en base coupe de toute façon la boucle dès qu'elle aboutit.
 */
const attempted = new Map<string, number>();

/**
 * Le ton relevé à la reconnexion, quand il manque encore.
 *
 * `ensureBrandIdentity` ne passait que dans l'analyse — et l'analyse ne se
 * refait qu'au changement de niveau — ou au moment d'écrire un article. Deux
 * comptes lui échappaient donc, et ce sont précisément ceux qui écrivent :
 * celui dont l'analyse portait déjà le niveau acheté (les Coups de Boost pris
 * avant l'ouverture de ce relevé), et celui dont la lecture avait échoué ce
 * jour-là sans jamais être retentée. Les deux faisaient écrire leurs articles
 * dans la voix de personne, et lisaient une carte vide au pied de l'atelier.
 *
 * La question se repose donc à chaque retour dans l'interface, pour les seules
 * offres où le ton sert : la démo, l'abonnement et le Coup de Boost. Un compte
 * qui l'a déjà ne déclenche rien — la condition est un champ nul en base, pas
 * une date. Un compte gratuit non plus, il ne publie pas.
 *
 * Appelée derrière `after()` : la lecture prend quelques secondes, et le
 * tableau de bord ne doit pas les attendre pour s'afficher.
 */
export async function backfillBrandTone(userId: string): Promise<void> {
  const last = attempted.get(userId);
  if (last && Date.now() - last < RETRY_AFTER_MS) return;

  try {
    const [{ tier }, profile] = await Promise.all([
      getAccess(userId),
      prisma.onboardingProfile.findUnique({
        where: { userId },
        select: {
          siteUrl: true,
          toneSummary: true,
          toneSampleUrl: true,
          brandColor: true,
        },
      }),
    ]);

    if (!profile?.siteUrl) return;
    if (!tierAtLeast(tier, "boost")) return;
    if (profile.toneSummary && profile.brandColor) return;

    attempted.set(userId, Date.now());
    await ensureBrandIdentity(userId, tier, profile);
  } catch (err) {
    // Rien de ce qui se passe ici ne concerne le client : il a déjà sa page.
    console.error("Rattrapage du ton de marque échoué :", err);
  }
}
