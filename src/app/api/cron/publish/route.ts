import { NextResponse } from "next/server";
import { publishDueArticles } from "@/features/dashboard/publish-queue";

export const runtime = "nodejs";
/** Vingt-cinq dépôts sur des sites qui répondent à leur rythme : il faut du temps. */
export const maxDuration = 300;
/** Une tâche planifiée ne doit jamais lire une réponse mise en cache. */
export const dynamic = "force-dynamic";

/**
 * La tâche planifiée qui publie les articles arrivés à échéance.
 *
 * Elle est appelée par le planificateur de la plateforme d'hébergement (voir
 * `vercel.json`), pas par un navigateur : personne n'est connecté quand elle
 * tourne, et c'est tout l'intérêt — le planning éditorial se déroule seul.
 *
 * L'entrée est fermée par `CRON_SECRET`. Sans ce secret dans l'environnement,
 * la route refuse tout le monde : mieux vaut une tâche qui ne part pas qu'une
 * URL publique capable de publier chez les clients. Vercel envoie ce secret
 * lui-même, en en-tête `Authorization`, dès qu'il est défini sur le projet.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET absent." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const run = await publishDueArticles();

  // Le détail par article reste dans les journaux du serveur : la réponse dit
  // seulement combien sont partis, pour que le tableau de bord du
  // planificateur affiche quelque chose de lisible.
  return NextResponse.json({
    due: run.due,
    published: run.published,
    failed: run.failed,
  });
}
