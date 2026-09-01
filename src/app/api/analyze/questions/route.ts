import { NextResponse } from "next/server";
import { generateNicheQuestions, fallbackQuestions } from "@/lib/geo/niche-questions";
import { normalizeUrl } from "@/lib/geo/fetcher";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { BusinessMode } from "@/lib/geo/types";

export const runtime = "nodejs";

/**
 * Les trois questions tapées sur l'écran d'attente, écrites pour le site qu'on
 * analyse.
 *
 * Cette route existe parce que l'écran d'attente s'ouvre avant que l'analyse
 * n'ait rendu quoi que ce soit : au moment où le clavier commence à taper, on ne
 * connaît du commerce que son adresse. La niche est donc déduite du domaine par
 * DeepSeek Flash, en parallèle de l'analyse — les deux appels partent ensemble
 * et l'écran se met à jour dès que celui-ci répond, sans jamais retarder l'autre.
 *
 * Elle ne rend jamais d'erreur au client : un écran d'attente qui afficherait
 * « impossible de charger les questions » remplacerait une animation par un
 * message d'échec, alors que l'analyse, elle, se déroule très bien. En cas de
 * pépin — URL illisible, modèle indisponible, quota atteint — on renvoie les
 * questions de repli avec un 200.
 */

/** Un appel de modèle par requête : on borne ce qu'une IP peut en tirer. */
const LIMIT = 12;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  let rawUrl = "";
  let mode: BusinessMode = "physical";
  try {
    const body = await request.json();
    rawUrl = String(body.url ?? "");
    mode = body.mode === "online" ? "online" : "physical";
  } catch {
    /* corps illisible : on retombe sur le repli générique plus bas */
  }

  const isPhysical = mode === "physical";

  let domain = "";
  try {
    domain = new URL(normalizeUrl(rawUrl)).hostname.replace(/^www\./, "");
  } catch {
    /* adresse invalide : rien à déduire, le repli suffit */
  }

  // Sans domaine lisible, il n'y a pas de niche à déduire : inutile de payer un
  // appel de modèle pour qu'il rende ce que le repli rend déjà.
  if (!domain) {
    return NextResponse.json({
      niche: null,
      questions: fallbackQuestions({ domain: "", isPhysical }),
    });
  }

  const limited = rateLimit(`questions:${clientIp(request)}`, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json({
      niche: null,
      questions: fallbackQuestions({ domain, isPhysical }),
    });
  }

  // `generateNicheQuestions` ne jette pas : son propre repli couvre déjà les
  // pannes de modèle. Le `catch` reste comme dernier filet.
  try {
    return NextResponse.json(await generateNicheQuestions({ domain, isPhysical }));
  } catch {
    return NextResponse.json({
      niche: null,
      questions: fallbackQuestions({ domain, isPhysical }),
    });
  }
}
