#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { ApiError, callAuthed, callPublic, hasToken } from "./api.js";
import { LOCAL_CHARTER, SERVER_INSTRUCTIONS } from "./charter.js";
import { API_URL, SERVER_NAME, SERVER_VERSION, detectClientName } from "./config.js";
import { formatFixes, formatStatus } from "./format.js";
import { CREDENTIALS_PATH, clearToken, writeToken } from "./store.js";

/**
 * Le serveur MCP got_the_ref.
 *
 * Il remplace le prompt qu'on copiait à la main. Avant : la plateforme écrivait
 * un texte de plusieurs milliers de caractères, le client le copiait, le collait
 * dans son agent, et espérait qu'il en reste quelque chose. Maintenant l'agent
 * va chercher lui-même le statut du compte puis les correctifs, et les applique.
 *
 * Six outils, pas un de plus, et aucun n'est généraliste. C'est délibéré : la
 * seule chose que ce serveur sait faire, c'est servir les correctifs d'un compte
 * et les expliquer. Un agent branché ici n'a pas d'autre prise — il n'y a rien
 * à détourner, parce qu'il n'y a rien d'autre.
 */

/** Le nom que le client verra sur son écran d'autorisation. */
const CLIENT_NAME = detectClientName();

/** Un appairage en cours, gardé le temps que le client confirme le code. */
let pending: { deviceCode: string; userCode: string; url: string; until: number } | null = null;

/** Ce qu'un tour d'attente peut prendre avant de rendre la main à l'agent. */
const WAIT_BUDGET_MS = 90_000;
const POLL_MS = 3_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function failure(error: unknown) {
  const message =
    error instanceof ApiError
      ? error.message
      : `Appel à got_the_ref impossible : ${String(error)}`;
  return { ...text(message), isError: true };
}

function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  /**
   * L'appairage. L'agent demande un code, le client le confirme dans son
   * navigateur, l'agent reçoit sa clé.
   *
   * L'attente est bornée : un outil qui bloque un quart d'heure se fait couper
   * par l'hôte, et l'agent croit à une panne. Passé le budget, on rend la main
   * en disant que l'appairage court toujours — le prochain appel reprend
   * l'attente là où elle en était, sur le même code.
   */
  server.registerTool(
    "got_the_ref_connexion",
    {
      title: "Connecter le compte got_the_ref",
      description:
        "Appaire cet agent au compte got_the_ref du client. Affiche un code à confirmer dans le navigateur, puis attend la confirmation. À lancer une seule fois par poste.",
      inputSchema: z.object({
        client: z
          .string()
          .max(60)
          .optional()
          .describe("Nom de l'agent montré au client sur l'écran d'autorisation."),
        reconnecter: z
          .boolean()
          .optional()
          .describe("Force un nouvel appairage même si un compte est déjà connecté."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ client, reconnecter }) => {
      const name = client?.trim() || CLIENT_NAME;

      if (hasToken() && !reconnecter) {
        return text(
          `Compte déjà connecté (clé : ${CREDENTIALS_PATH}). Enchaîne avec got_the_ref_statut, puis got_the_ref_correctifs.`,
        );
      }

      try {
        // Reprise d'un appairage encore vivant : réafficher un nouveau code
        // ferait mentir celui que le client a déjà sous les yeux.
        if (!pending || pending.until < Date.now()) {
          const started = await callPublic("/api/mcp/device", { client: name });
          pending = {
            deviceCode: String(started.device_code),
            userCode: String(started.user_code),
            url: String(started.verification_url),
            until: Date.now() + Number(started.expires_in ?? 900) * 1000,
          };
        }

        const deadline = Date.now() + WAIT_BUDGET_MS;
        while (Date.now() < deadline && Date.now() < pending.until) {
          const poll = await callPublic("/api/mcp/token", { device_code: pending.deviceCode });
          const status = String(poll.status);

          if (status === "approved") {
            writeToken(String(poll.access_token), API_URL, name);
            pending = null;
            const statut = await callAuthed("/api/mcp/me");
            return text(
              `Compte connecté. Clé rangée dans ${CREDENTIALS_PATH}.\n\n${formatStatus(statut)}`,
            );
          }
          if (status === "denied") {
            pending = null;
            return text("Connexion refusée par le client. Rien n'a été accordé.");
          }
          if (status === "expired") {
            pending = null;
            return text("Le code a expiré. Relance got_the_ref_connexion pour en obtenir un neuf.");
          }

          await sleep(POLL_MS);
        }

        return text(
          [
            `Appairage en attente. Demande au client d'ouvrir cette adresse et de confirmer le code :`,
            "",
            `    ${pending.url}`,
            `    Code : ${pending.userCode}`,
            "",
            "Puis relance got_the_ref_connexion : l'attente reprend sur le même code.",
          ].join("\n"),
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "got_the_ref_statut",
    {
      title: "Relever le statut du compte",
      description:
        "Relève l'offre du compte, le site suivi, la dernière analyse et les chantiers que l'offre ouvre. À appeler avant toute modification.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        return text(formatStatus(await callAuthed("/api/mcp/me")));
      } catch (error) {
        return failure(error);
      }
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
          .enum(["results", "content", "architecture", "articles", "presence", "maps"])
          .optional()
          .describe("Limite la réponse à un chantier. Sans valeur, tous les chantiers ouverts."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ chantier }) => {
      try {
        const path = chantier
          ? `/api/mcp/fixes?chantier=${encodeURIComponent(chantier)}`
          : "/api/mcp/fixes";
        return text(formatFixes(await callAuthed(path)));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "got_the_ref_expliquer",
    {
      title: "Expliquer l'analyse et les correctifs",
      description:
        "Répond aux questions du client sur son analyse GEO et sur les correctifs de la plateforme : ce que mesure un contrôle, pourquoi un manque compte, ce qu'un correctif change. Toute question étrangère à ce dossier est refusée par la plateforme.",
      inputSchema: z.object({
        question: z.string().min(3).max(1_000).describe("La question du client, telle qu'il la pose."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ question }) => {
      try {
        const payload = await callAuthed("/api/mcp/explain", {
          method: "POST",
          body: { question },
        });
        return text(String(payload.reponse ?? ""));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "got_the_ref_signaler",
    {
      title: "Signaler les correctifs appliqués",
      description:
        "Dit à la plateforme quels correctifs ont été posés et lesquels ont été écartés. À appeler après chaque passe : c'est ce que le client lit dans son tableau de bord.",
      inputSchema: z.object({
        chantier: z
          .enum(["results", "content", "architecture", "articles", "presence", "maps"])
          .describe("Le chantier sur lequel la passe vient d'avoir lieu."),
        appliques: z.array(z.string().max(300)).max(50).describe("Les correctifs réellement posés."),
        ecartes: z
          .array(z.string().max(300))
          .max(50)
          .optional()
          .describe("Ceux laissés de côté, avec leur raison."),
        note: z.string().max(2_000).optional().describe("Ce que le client doit savoir de la passe."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ chantier, appliques, ecartes, note }) => {
      try {
        const payload = await callAuthed("/api/mcp/report", {
          method: "POST",
          body: { chantier, appliques, ecartes: ecartes ?? [], note },
        });
        return text(
          `Passe enregistrée : ${payload.appliques} correctif(s) appliqué(s), ${payload.ecartes} écarté(s). Le client la voit dans son tableau de bord.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "got_the_ref_deconnexion",
    {
      title: "Déconnecter cet agent",
      description: "Révoque la clé de cet agent et efface le fichier local. Le compte n'est plus accessible depuis ce poste.",
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        await callAuthed("/api/mcp/revoke", { method: "POST" });
      } catch {
        // La clé était déjà morte côté serveur : le fichier local part quand même.
      }
      clearToken();
      return text("Agent déconnecté. La clé locale est effacée et l'accès révoqué côté got_the_ref.");
    },
  );

  /**
   * L'activation de l'agent, pour les hôtes qui savent lire les prompts MCP.
   *
   * La charte locale n'est qu'un point de départ : le premier appel d'outil
   * rapporte celle du serveur, et c'est elle qui fait foi.
   */
  server.registerPrompt(
    "got_the_ref",
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
            text: `${LOCAL_CHARTER}

Commence maintenant : appelle got_the_ref_statut, puis got_the_ref_correctifs. Applique les correctifs reçus sur le code du site, un chantier après l'autre, en recopiant les textes fournis mot pour mot. Termine par got_the_ref_signaler.`,
          },
        },
      ],
    }),
  );

  return server;
}

const handle = serveStdio(() => buildServer());

const exit = async () => {
  await handle.close();
  process.exit(0);
};

process.on("SIGINT", exit);
process.on("SIGTERM", exit);
