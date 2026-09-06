import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AGENT_CHARTER, AGENT_NAME, CHARTER_REMINDER } from "./charter";
import { explainAnalysis } from "./explain";
import { formatFixes, formatStatus } from "./format";
import { buildFixes, buildStatus } from "./payload";
import type { McpIdentity } from "./tokens";

/**
 * Le serveur MCP got_the_ref, tel qu'il tourne dans l'application.
 *
 * MCP (Model Context Protocol) est la prise standard entre un agent IA et un
 * service. Cette prise-ci ne s'installe plus sur le poste du client : elle est
 * servie par le site, en HTTP, à l'adresse `/mcp/<clé>`. L'agent du client s'y
 * branche par une seule commande et n'a rien à télécharger — aucun paquet npm,
 * aucune version à tenir à jour, aucun poste où la charte pourrait diverger de
 * celle du serveur.
 *
 * Quatre outils, pas un de plus, et aucun n'est généraliste. C'est délibéré :
 * la seule chose que ce serveur sait faire, c'est servir les correctifs d'un
 * compte et les expliquer. Un agent branché ici n'a pas d'autre prise — il n'y
 * a rien à détourner, parce qu'il n'y a rien d'autre.
 *
 * La révocation ne figure volontairement pas parmi les outils : couper l'accès
 * est un geste du client, depuis son tableau de bord, pas une action qu'on
 * pourrait souffler à son agent.
 */

/** L'identité que le serveur annonce à l'agent au moment de la poignée de main. */
export const SERVER_INFO = { name: AGENT_NAME, version: "1.0.0" } as const;

/**
 * Ce que l'agent lit avant son premier appel.
 *
 * La charte vit sur le serveur et part avec la poignée de main : aucune version
 * installée quelque part ne peut la contredire, et la faire évoluer ne demande
 * à personne de mettre quoi que ce soit à jour.
 */
export const SERVER_INSTRUCTIONS = AGENT_CHARTER;

/** Les chantiers du tableau de bord, seules valeurs qu'un filtre accepte. */
const CHANTIERS = [
  "results",
  "content",
  "architecture",
  "articles",
  "presence",
  "maps",
] as const;

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function failure(message: string) {
  return { ...text(message), isError: true };
}

/**
 * Équipe le serveur des outils d'un compte donné.
 *
 * L'identité vient de la clé portée par l'URL et n'est jamais un paramètre
 * d'outil : un agent ne peut pas demander le dossier d'un autre compte, la
 * question ne se pose pas — il n'y a pas de champ pour la poser.
 *
 * Le serveur est fourni par l'adaptateur HTTP, qui en monte un neuf à chaque
 * requête. Rien ne survit d'un appel au suivant : c'est ce qui rend le tout
 * exécutable sur des fonctions serverless, où deux requêtes d'un même agent
 * n'atterrissent pas forcément sur la même instance.
 */
export function registerGotTheRefTools(server: McpServer, identity: McpIdentity): void {
  server.registerTool(
    "got_the_ref_statut",
    {
      title: "Relever le statut du compte",
      description:
        "Relève l'offre du compte, le site suivi, la dernière analyse et les chantiers que l'offre ouvre. À appeler avant toute modification.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: { email: true },
      });
      if (!user) return failure("Compte introuvable.");

      const statut = await buildStatus(identity.userId, user.email);
      return text(formatStatus(statut, identity.clientName, CHARTER_REMINDER));
    },
  );

  server.registerTool(
    "got_the_ref_correctifs",
    {
      title: "Relever les correctifs à appliquer",
      description:
        "Rend les correctifs décidés par la plateforme, avec les textes exacts à poser (title, méta description, H1, JSON-LD, fichiers, articles). Ce sont les seuls correctifs à appliquer : rien d'autre ne doit être modifié.",
      inputSchema: z.object({
        chantier: z
          .enum(CHANTIERS)
          .optional()
          .describe("Limite la réponse à un chantier. Sans valeur, tous les chantiers ouverts."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ chantier }) => {
      const fixes = await buildFixes(identity.userId);
      if (!fixes) {
        return failure(
          "Aucune analyse rattachée à ce compte. Lance l'audit depuis le tableau de bord got_the_ref.",
        );
      }

      if (!chantier) return text(formatFixes(fixes));

      const correctifs = fixes.correctifs.filter((item) => item.chantier === chantier);
      if (correctifs.length === 0) {
        return failure(
          `Chantier inconnu : « ${chantier} ». Chantiers disponibles : ${fixes.correctifs
            .map((item) => item.chantier)
            .join(", ")}.`,
        );
      }

      return text(formatFixes({ ...fixes, correctifs }));
    },
  );

  server.registerTool(
    "got_the_ref_expliquer",
    {
      title: "Expliquer l'analyse et les correctifs",
      description:
        "Répond aux questions du client sur son analyse GEO et sur les correctifs de la plateforme : ce que mesure un contrôle, pourquoi un manque compte, ce qu'un correctif change. Toute question étrangère à ce dossier est refusée par la plateforme.",
      inputSchema: z.object({
        question: z
          .string()
          .min(3)
          .max(1_000)
          .describe("La question du client, telle qu'il la pose."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ question }) => {
      const outcome = await explainAnalysis(identity.userId, question);
      return text(outcome.reponse);
    },
  );

  server.registerTool(
    "got_the_ref_signaler",
    {
      title: "Signaler les correctifs appliqués",
      description:
        "Dit à la plateforme quels correctifs ont été posés et lesquels ont été écartés. À appeler après chaque passe : c'est ce que le client lit dans son tableau de bord.",
      inputSchema: z.object({
        chantier: z.enum(CHANTIERS).describe("Le chantier sur lequel la passe vient d'avoir lieu."),
        appliques: z
          .array(z.string().trim().min(1).max(300))
          .max(50)
          .describe("Les correctifs réellement posés."),
        ecartes: z
          .array(z.string().trim().min(1).max(300))
          .max(50)
          .optional()
          .describe("Ceux laissés de côté, avec leur raison."),
        note: z
          .string()
          .trim()
          .max(2_000)
          .optional()
          .describe("Ce que le client doit savoir de la passe."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ chantier, appliques, ecartes, note }) => {
      await prisma.mcpFixReport.create({
        data: {
          userId: identity.userId,
          clientName: identity.clientName,
          chantier,
          applied: appliques,
          skipped: ecartes ?? [],
          note: note ?? null,
        },
      });

      return text(
        `Passe enregistrée : ${appliques.length} correctif(s) appliqué(s), ${
          (ecartes ?? []).length
        } écarté(s). Le client la voit dans son tableau de bord.`,
      );
    },
  );

  /**
   * L'activation de l'agent, pour les hôtes qui savent lire les prompts MCP.
   *
   * La charte part déjà dans les `instructions` du serveur et repart avec
   * chaque relevé ; ce prompt ne fait qu'offrir au client une façon de la
   * déclencher à la main, et de lancer la première passe.
   */
  server.registerPrompt(
    AGENT_NAME,
    {
      title: "Activer l'agent got_the_ref",
      description:
        "Met l'agent en mode got_the_ref : il applique les correctifs de la plateforme, et rien d'autre.",
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${AGENT_CHARTER}

Commence maintenant : appelle got_the_ref_statut, puis got_the_ref_correctifs. Applique les correctifs reçus sur le code du site, un chantier après l'autre, en recopiant les textes fournis mot pour mot. Termine par got_the_ref_signaler.`,
          },
        },
      ],
    }),
  );
}
