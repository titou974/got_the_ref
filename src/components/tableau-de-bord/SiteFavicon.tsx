"use client";

import { useState } from "react";
import { cx } from "@/lib/utils";

/**
 * L'icône du site suivi.
 *
 * Prise chez Google, qui la sert pour presque tous les domaines : aller la
 * chercher nous-mêmes voudrait dire une route serveur de plus, avec sa liste
 * d'hôtes interdits et son cache, pour une image de vingt pixels.
 *
 * Si elle ne charge pas, l'initiale du domaine prend sa place : un carré vide se
 * lirait comme une image cassée.
 */
export function SiteFavicon({ domain, className = "" }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = cx("h-5 w-5 shrink-0 rounded-md", className);

  if (failed) {
    return (
      <span
        aria-hidden
        className={cx(
          box,
          "flex items-center justify-center bg-mist text-[11px] font-bold uppercase text-steel",
        )}
      >
        {domain.charAt(0)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      onError={() => setFailed(true)}
      className={box}
    />
  );
}
