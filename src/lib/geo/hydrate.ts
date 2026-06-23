import type { GeoAnalysisResult, BusinessProfile, WebPresence } from "./types";

/**
 * Rétro-compatibilité : les analyses créées avant la Phase 5 ne contiennent ni
 * profil, ni classements, ni présence web. On comble ces champs avec des
 * valeurs neutres pour que le rendu ne casse jamais sur un ancien enregistrement.
 */
export function hydrateAnalysisResult(
  raw: GeoAnalysisResult & Partial<{
    profile: BusinessProfile;
    localRankings: GeoAnalysisResult["localRankings"];
    webPresence: WebPresence;
  }>,
): GeoAnalysisResult {
  const hasMaps = !!raw.mapsUrl;

  const profile: BusinessProfile = raw.profile ?? {
    mode: hasMaps ? "physical" : "online",
    isPhysical: hasMaps,
    niche: raw.businessType || raw.businessName || "Activité non déterminée",
    generalCategory: raw.businessType || "Commerce",
    location: null,
  };

  const webPresence: WebPresence = raw.webPresence ?? {
    score: 0,
    summary: "Notoriété éditoriale non analysée pour cette analyse.",
    qualifications: [],
    articles: [],
    findings: [],
  };

  return {
    ...raw,
    profile,
    localRankings: Array.isArray(raw.localRankings) ? raw.localRankings : [],
    webPresence,
  };
}
