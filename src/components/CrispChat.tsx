"use client";

import { useEffect } from "react";
import { SITE } from "@/constants/site";

/**
 * La bulle de discussion Crisp, montée uniquement là où un humain répond.
 *
 * Elle n'a rien à faire sur les pages publiques : un visiteur qui hésite encore
 * doit lire la promesse, pas être happé par une bulle. En revanche, dès le
 * tunnel d'accueil et sur le tableau de bord, le client paie et attend qu'on
 * lui réponde — c'est là, et seulement là, que la bulle a un sens.
 *
 * Le script tiers, lui, ne se démonte pas : une fois `l.js` chargé, Crisp reste
 * en mémoire pour toute la durée de la page. On ne le recharge donc jamais, on
 * se contente de montrer puis de masquer la bulle au fil des navigations
 * côté client. Sans ce masquage au démontage, la bulle suivrait le client
 * jusque sur la page d'accueil.
 */

/** La file d'attente Crisp : des commandes empilées avant même le chargement. */
type CrispQueue = unknown[][];

declare global {
  interface Window {
    $crisp?: CrispQueue;
    CRISP_WEBSITE_ID?: string;
  }
}

const SCRIPT_SRC = "https://client.crisp.chat/l.js";

export function CrispChat() {
  useEffect(() => {
    const websiteId = SITE.crispWebsiteId;
    if (!websiteId) return;

    window.$crisp = window.$crisp ?? [];
    window.CRISP_WEBSITE_ID = websiteId;

    // Une seule injection par chargement de page : React démonte et remonte ce
    // composant à chaque va-et-vient entre sections, `l.js` ne doit suivre.
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }

    window.$crisp.push(["do", "chat:show"]);

    return () => {
      window.$crisp?.push(["do", "chat:hide"]);
    };
  }, []);

  return null;
}
