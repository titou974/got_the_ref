import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { businessHint, getDashboardContext, listProspects } from "@/features/dashboard/queries";
import { Card, CardTitle, PageHeader } from "@/components/tableau-de-bord/Card";
import { ProspectFlow } from "@/components/tableau-de-bord/ProspectFlow";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Présence web : ce que le web dit déjà du commerce, et à qui écrire pour qu'il
 * en dise davantage.
 *
 * La prospection ouvre la page, parce que c'est le seul endroit du tableau de
 * bord où le client a quelque chose à faire de ses mains ; ce que le web dit
 * déjà de lui vient après, comme un état des lieux. Le calendrier éditorial
 * vit dans la section Articles, et nulle part ailleurs : deux écrans qui
 * montrent le même planning font douter le client de ce qu'il regarde.
 */
export default async function PresencePage() {
  const user = await requireUser();
  const [context, prospects] = await Promise.all([
    getDashboardContext(user.id),
    listProspects(user.id),
  ]);
  const t = await getTranslations("dashboard.presence");

  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;
  const presence = analysis.webPresence;
  const backlinks = analysis.backlinks ?? null;

  // Notoriété et backlinks se travaillent dans la durée : la section est
  // réservée à l'abonnement, et voilée pour tous les autres.
  const locked = !canOpen(context.tier, "presence");

  // Sous voile, la page garde son titre : le parcours, lui, ne se monte pas —
  // c'est lui qui porte le sien.
  if (locked) {
    return (
      <>
        <PageHeader title={t("pageTitle")} />
        <SectionGate section="presence" locked>
          <></>
        </SectionGate>
      </>
    );
  }

  return (
    <>
      <ProspectFlow
        prospects={prospects.map((prospect) => ({
          id: prospect.id,
          name: prospect.name,
          domain: prospect.domain,
          reason: prospect.reason,
          contactEmail: prospect.contactEmail,
          contactUrl: prospect.contactUrl,
          authority: prospect.authority,
          status: prospect.status,
          message: prospect.message,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title={t("reputation")} hint={presence.summary} />
          {presence.qualifications.length === 0 && presence.articles.length === 0 ? (
            <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
              {t("noMentions")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {presence.qualifications.map((qualification) => (
                <li key={qualification.label} className="py-3">
                  <p className="text-sm font-medium">{qualification.label}</p>
                  <p className="text-xs text-muted">
                    {qualification.source} · {qualification.detail}
                  </p>
                </li>
              ))}
              {presence.articles.map((article) => (
                <li key={article.title} className="py-3">
                  <p className="text-sm font-medium">{article.title}</p>
                  <p className="text-xs text-muted">{article.source}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            title={t("backlinks")}
            hint={backlinks?.summary ?? t("backlinksUnknown")}
            action={
              backlinks?.estimatedCount !== null && backlinks?.estimatedCount !== undefined ? (
                <span className="rounded-xl bg-mist px-3 py-1 text-sm font-semibold tabular-nums">
                  {backlinks.estimatedCount}
                </span>
              ) : undefined
            }
          />
          {backlinks?.notableSources.length ? (
            <ul className="divide-y divide-border">
              {backlinks.notableSources.map((source) => (
                <li key={source.domain} className="py-3">
                  <p className="text-sm font-medium">{source.domain}</p>
                  <p className="text-xs text-muted">{source.note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
              {t("noBacklinks")}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
