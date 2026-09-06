import "server-only";

import type { McpFixes, McpStatus } from "./payload";

/**
 * La mise en forme de ce que la plateforme sert à l'agent.
 *
 * Un agent lit du texte : lui passer le JSON brut lui ferait dépenser son
 * attention à démêler des accolades. On le met donc en pages, dans l'ordre où
 * il doit travailler — le cadre d'abord, la matière ensuite, le rappel en
 * dernier, juste avant qu'il ne se mette au travail.
 *
 * La matière elle-même n'est jamais retouchée : les dossiers sortent de
 * `payload.ts` et repartent tels quels. Un caractère perdu ici, c'est une
 * balise cassée sur le site du client.
 *
 * Ce fichier tournait auparavant sur le poste du client, dans le paquet npm.
 * Il tourne désormais sur le serveur, avec les types réels des dossiers plutôt
 * qu'une copie approximative : une forme qui change ne peut plus se traduire
 * par un champ silencieusement vide chez le client.
 */

export function formatStatus(
  statut: McpStatus,
  agentName: string,
  rappel: string,
): string {
  const lines: string[] = ["# Statut du compte got_the_ref", ""];

  lines.push(`- Compte : ${statut.compte.email}`);
  lines.push(`- Offre : ${statut.compte.offreLabel}`);
  if (statut.compte.redactionJusquau) {
    lines.push(`- Rédaction ouverte jusqu'au : ${statut.compte.redactionJusquau}`);
  }
  lines.push(`- Agent connecté : ${agentName}`);

  if (statut.site) {
    lines.push("", "## Site");
    lines.push(`- Domaine : ${statut.site.domaine ?? "—"}`);
    if (statut.site.nom) lines.push(`- Nom : ${statut.site.nom}`);
    if (statut.site.niche) lines.push(`- Niche : ${statut.site.niche}`);
    if (statut.site.plateforme) lines.push(`- Plateforme : ${statut.site.plateforme}`);
  } else {
    lines.push("", "Aucune analyse rattachée à ce compte pour l'instant.");
  }

  if (statut.analyse) {
    lines.push(
      `- Note GEO : ${statut.analyse.note}/100 (relevée le ${statut.analyse.date})`,
    );
  }

  if (statut.chantiers.length) {
    lines.push("", "## Chantiers");
    for (const chantier of statut.chantiers) {
      lines.push(
        chantier.ouvert
          ? `- ${chantier.libelle} : ouvert`
          : `- ${chantier.libelle} : fermé — s'ouvre avec ${chantier.offreRequise}`,
      );
    }
  }

  lines.push("", rappel);
  return lines.join("\n");
}

export function formatFixes(fixes: McpFixes): string {
  const lines: string[] = ["# Correctifs à appliquer", ""];

  if (fixes.site) {
    lines.push(
      `Site : ${fixes.site.domaine ?? "—"}${fixes.site.niche ? ` — ${fixes.site.niche}` : ""}${
        fixes.site.plateforme ? ` (${fixes.site.plateforme})` : ""
      }`,
    );
  }
  lines.push(`Offre du compte : ${fixes.offre.label}`);

  const ouverts = fixes.correctifs.filter((correctif) => correctif.ouvert);

  if (fixes.recommandations.length) {
    lines.push("", "## Plan d'action", "");
    for (const reco of fixes.recommandations) {
      lines.push(`- [${reco.priorite}] ${reco.titre} — ${reco.description}`);
    }
  }

  for (const chantier of ouverts) {
    lines.push("", `## ${chantier.libelle}`, "");
    lines.push(chantier.dossier.trim());
  }

  if (fixes.fermes.length) {
    lines.push("", "## Fermé par l'offre du compte", "");
    for (const ferme of fixes.fermes) {
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

  lines.push("", fixes.rappel);
  return lines.join("\n");
}
