/**
 * La mise en forme de ce que la plateforme renvoie.
 *
 * Un agent lit du texte : lui passer le JSON brut lui ferait dépenser son
 * attention à démêler des accolades. On le met donc en pages, dans l'ordre où
 * il doit travailler — le cadre d'abord, la matière ensuite, le rappel en
 * dernier, juste avant qu'il ne se mette au travail.
 *
 * La matière elle-même n'est jamais retouchée : les dossiers arrivent du
 * serveur et repartent tels quels. Un caractère perdu ici, c'est une balise
 * cassée sur le site du client.
 */

type Chantier = {
  chantier: string;
  libelle: string;
  ouvert: boolean;
  offreRequise: string | null;
  dossier: string;
};

type Fixes = {
  site?: { domaine?: string; nom?: string; niche?: string; plateforme?: string | null } | null;
  offre?: { label?: string };
  correctifs?: Chantier[];
  recommandations?: { titre: string; description: string; priorite: string }[];
  fermes?: { libelle: string; offreRequise: string }[];
  rappel?: string;
};

type Statut = {
  compte?: { email?: string; offreLabel?: string; redactionJusquau?: string | null };
  site?: { domaine?: string | null; nom?: string; niche?: string | null; plateforme?: string | null } | null;
  analyse?: { note?: number; date?: string } | null;
  chantiers?: { libelle: string; ouvert: boolean; offreRequise: string | null }[];
  agent?: { nom?: string };
  rappel?: string;
};

export function formatStatus(payload: Statut): string {
  const lines: string[] = ["# Statut du compte got_the_ref", ""];

  lines.push(`- Compte : ${payload.compte?.email ?? "inconnu"}`);
  lines.push(`- Offre : ${payload.compte?.offreLabel ?? "inconnue"}`);
  if (payload.compte?.redactionJusquau) {
    lines.push(`- Rédaction ouverte jusqu'au : ${payload.compte.redactionJusquau}`);
  }
  if (payload.agent?.nom) lines.push(`- Agent appairé : ${payload.agent.nom}`);

  if (payload.site) {
    lines.push("", "## Site");
    lines.push(`- Domaine : ${payload.site.domaine ?? "—"}`);
    if (payload.site.nom) lines.push(`- Nom : ${payload.site.nom}`);
    if (payload.site.niche) lines.push(`- Niche : ${payload.site.niche}`);
    if (payload.site.plateforme) lines.push(`- Plateforme : ${payload.site.plateforme}`);
  } else {
    lines.push("", "Aucune analyse rattachée à ce compte pour l'instant.");
  }

  if (payload.analyse) {
    lines.push(`- Note GEO : ${payload.analyse.note ?? "—"}/100 (relevée le ${payload.analyse.date ?? "—"})`);
  }

  if (payload.chantiers?.length) {
    lines.push("", "## Chantiers");
    for (const chantier of payload.chantiers) {
      lines.push(
        chantier.ouvert
          ? `- ${chantier.libelle} : ouvert`
          : `- ${chantier.libelle} : fermé — s'ouvre avec ${chantier.offreRequise}`,
      );
    }
  }

  if (payload.rappel) lines.push("", payload.rappel);
  return lines.join("\n");
}

export function formatFixes(payload: Fixes): string {
  const lines: string[] = ["# Correctifs à appliquer", ""];

  if (payload.site) {
    lines.push(
      `Site : ${payload.site.domaine ?? "—"}${payload.site.niche ? ` — ${payload.site.niche}` : ""}${
        payload.site.plateforme ? ` (${payload.site.plateforme})` : ""
      }`,
    );
  }
  if (payload.offre?.label) lines.push(`Offre du compte : ${payload.offre.label}`);

  const ouverts = (payload.correctifs ?? []).filter((c) => c.ouvert);
  const fermes = payload.fermes ?? [];

  if (payload.recommandations?.length) {
    lines.push("", "## Plan d'action", "");
    for (const reco of payload.recommandations) {
      lines.push(`- [${reco.priorite}] ${reco.titre} — ${reco.description}`);
    }
  }

  for (const chantier of ouverts) {
    lines.push("", `## ${chantier.libelle}`, "");
    lines.push(chantier.dossier.trim());
  }

  if (fermes.length) {
    lines.push("", "## Fermé par l'offre du compte", "");
    for (const ferme of fermes) {
      lines.push(`- ${ferme.libelle} — s'ouvre avec ${ferme.offreRequise}`);
    }
    lines.push(
      "",
      "Ces chantiers ne sont pas à deviner ni à reconstituer : indique au client l'offre qui les ouvre, puis passe au suivant.",
    );
  }

  if (!ouverts.length) {
    lines.push("", "Aucun chantier ouvert sur cette offre. Il n'y a rien à appliquer.");
  }

  if (payload.rappel) lines.push("", payload.rappel);
  return lines.join("\n");
}
