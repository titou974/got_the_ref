import "server-only";

import { prisma } from "@/lib/prisma";

/** Contrôle de forme — la vérité reste la validation de la modale de saisie. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalise une adresse ; renvoie `null` si elle n'a pas la forme d'un e-mail. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

/**
 * Enregistre (ou met à jour) l'adresse laissée avant une analyse gratuite.
 *
 * Idempotent par e-mail : relancer une analyse avec la même adresse n'ajoute
 * pas de doublon, mais rafraîchit le dernier domaine analysé et le compteur —
 * c'est ce qui permet, plus tard, de segmenter les envois Resend.
 *
 * Une désinscription n'est jamais annulée ici : `marketingOptIn` et
 * `unsubscribedAt` ne sont posés qu'à la création.
 */
export async function captureLead(params: {
  email: string;
  domain?: string | null;
  analysisId?: string | null;
  source?: string;
}): Promise<void> {
  const email = normalizeEmail(params.email);
  if (!email) return;

  const now = new Date();
  await prisma.lead.upsert({
    where: { email },
    create: {
      email,
      source: params.source ?? "free_analysis",
      domain: params.domain ?? null,
      lastAnalysisId: params.analysisId ?? null,
      lastAnalysisAt: now,
    },
    update: {
      domain: params.domain ?? undefined,
      lastAnalysisId: params.analysisId ?? undefined,
      lastAnalysisAt: now,
      analysisCount: { increment: 1 },
    },
  });
}

export type MailingLead = {
  email: string;
  domain: string | null;
  analysisCount: number;
  lastAnalysisAt: Date;
  createdAt: Date;
};

/**
 * Adresses joignables pour une campagne : consentement en cours, désinscrits
 * exclus. C'est la source à donner à Resend (audience ou envoi en lot).
 */
export async function listMailingLeads(options?: {
  limit?: number;
  /** Ne renvoie que les adresses laissées après cette date. */
  since?: Date;
}): Promise<MailingLead[]> {
  return prisma.lead.findMany({
    where: {
      marketingOptIn: true,
      unsubscribedAt: null,
      ...(options?.since ? { createdAt: { gte: options.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit,
    select: {
      email: true,
      domain: true,
      analysisCount: true,
      lastAnalysisAt: true,
      createdAt: true,
    },
  });
}

/** Sort une adresse de la liste de diffusion, sans effacer son historique. */
export async function unsubscribeLead(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;

  const updated = await prisma.lead.updateMany({
    where: { email, unsubscribedAt: null },
    data: { marketingOptIn: false, unsubscribedAt: new Date() },
  });
  return updated.count > 0;
}
