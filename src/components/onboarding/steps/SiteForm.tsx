"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { PillField } from "@/components/onboarding/Field";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { CrawlOverlay } from "@/components/onboarding/CrawlOverlay";
import { saveSiteAction } from "@/features/onboarding/actions";

/**
 * Étape 2 — le site, et la fiche Google Maps pour un commerce qui reçoit du
 * public.
 *
 * C'est la seule étape qui fait attendre : derrière le bouton, le site est
 * crawlé page par page puis relu. D'où le voile d'attente, qui dit ce qui se
 * passe — un bouton figé pendant une minute passe pour un plantage.
 */
export function SiteForm({
  physical,
  initialSiteUrl,
  initialMapsUrl,
}: {
  physical: boolean;
  initialSiteUrl: string | null;
  initialMapsUrl: string | null;
}) {
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl ?? "");
  const [mapsUrl, setMapsUrl] = useState(initialMapsUrl ?? "");
  const { execute, isPending, result } = useAction(saveSiteAction);

  const siteError = result.validationErrors?.siteUrl?._errors?.[0];
  const mapsError = result.validationErrors?.mapsUrl?._errors?.[0];

  return (
    <>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          execute({ siteUrl, mapsUrl });
        }}
      >
        <PillField
          name="siteUrl"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoFocus
          placeholder="votresite.fr"
          value={siteUrl}
          onChange={(event) => setSiteUrl(event.target.value)}
          error={siteError}
        />

        {physical && (
          <PillField
            name="mapsUrl"
            type="text"
            inputMode="url"
            placeholder="Lien de votre fiche Google Maps"
            label="Fiche Google Maps (facultatif)"
            value={mapsUrl}
            onChange={(event) => setMapsUrl(event.target.value)}
            error={mapsError}
            hint="Ouvrez votre fiche, cliquez sur Partager, puis copiez le lien."
          />
        )}

        {result.serverError && <p className="text-sm text-danger">{result.serverError}</p>}

        <StepFooter
          label="Analyser mon site"
          pendingLabel="Lecture de votre site…"
          disabled={siteUrl.trim().length < 3}
          pending={isPending}
        />
      </form>

      {isPending && <CrawlOverlay />}
    </>
  );
}
