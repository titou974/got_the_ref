"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  draftProspectMessageAction,
  findProspectsAction,
  setProspectStatusAction,
} from "@/features/dashboard/actions";
import { Card, CardTitle } from "./Card";

/**
 * Les sites de la niche à démarcher, et l'état de chaque prise de contact.
 *
 * Le message est préparé ici mais parti d'ailleurs : l'envoi passe par la messagerie
 * du client, via un lien `mailto:`. Envoyer nous-mêmes depuis notre domaine
 * ferait arriver la demande sous une signature que le destinataire ne connaît
 * pas, et abîmerait la réputation d'envoi partagée par tous les comptes.
 *
 * Quand l'adresse n'a pas été trouvée, la ligne renvoie vers la page contact du
 * site plutôt que d'afficher une adresse plausible.
 */

export type ProspectRow = {
  id: string;
  name: string;
  domain: string;
  reason: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  authority: number;
  status: string;
  message: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  found: "bg-mist text-steel",
  drafted: "bg-obsidian/[0.06] text-ink",
  contacted: "bg-warning/10 text-warning",
  replied: "bg-success/10 text-success",
  published: "bg-success/10 text-success",
  declined: "bg-danger/10 text-danger",
};

export function ProspectTable({ prospects }: { prospects: ProspectRow[] }) {
  const t = useTranslations("dashboard.presence");
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const find = useAction(findProspectsAction, { onSuccess: () => router.refresh() });

  return (
    <Card>
      <CardTitle
        title={t("networkTitle")}
        hint={t("networkHint")}
        action={
          <button
            type="button"
            onClick={() => find.execute({})}
            disabled={find.isPending}
            className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
          >
            {find.isPending ? t("searching") : prospects.length ? t("searchMore") : t("search")}
          </button>
        }
      />

      {find.result.serverError ? (
        <p className="mb-3 text-sm text-danger">{find.result.serverError}</p>
      ) : null}

      {prospects.length === 0 ? (
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {prospects.map((prospect) => (
            <ProspectRowView
              key={prospect.id}
              prospect={prospect}
              open={openId === prospect.id}
              onToggle={() => setOpenId(openId === prospect.id ? null : prospect.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProspectRowView({
  prospect,
  open,
  onToggle,
}: {
  prospect: ProspectRow;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("dashboard.presence");
  const router = useRouter();
  const draft = useAction(draftProspectMessageAction, { onSuccess: () => router.refresh() });
  const setStatus = useAction(setProspectStatusAction, { onSuccess: () => router.refresh() });

  const mailto = prospect.contactEmail
    ? `mailto:${prospect.contactEmail}?subject=${encodeURIComponent(
        prospect.message?.split("\n")[0] ?? "",
      )}&body=${encodeURIComponent(prospect.message?.split("\n").slice(2).join("\n") ?? "")}`
    : null;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span className="w-10 shrink-0 text-center">
            <span className="block text-sm font-bold tabular-nums">{prospect.authority}</span>
            <span className="block text-[10px] uppercase tracking-wide text-ash">
              {t("authority")}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{prospect.name}</span>
            <span className="block truncate text-xs text-muted">{prospect.domain}</span>
          </span>
        </button>

        <span
          className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
            STATUS_STYLE[prospect.status] ?? "bg-mist text-steel"
          }`}
        >
          {t(`status.${prospect.status}`)}
        </span>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 rounded-2xl bg-mist p-4">
          {prospect.reason ? <p className="text-sm text-muted">{prospect.reason}</p> : null}

          <p className="text-sm">
            {prospect.contactEmail ? (
              <span className="font-medium">{prospect.contactEmail}</span>
            ) : prospect.contactUrl ? (
              <a
                href={prospect.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              >
                {t("contactPage")}
              </a>
            ) : (
              <span className="text-muted">{t("noContact")}</span>
            )}
          </p>

          {prospect.message ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface p-3 text-[13px] leading-relaxed">
              {prospect.message}
            </pre>
          ) : null}

          {draft.result.serverError ? (
            <p className="text-sm text-danger">{draft.result.serverError}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => draft.execute({ id: prospect.id })}
              disabled={draft.isPending}
              className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
            >
              {draft.isPending ? t("drafting") : prospect.message ? t("redraft") : t("draft")}
            </button>

            {mailto ? (
              <a
                href={mailto}
                onClick={() => setStatus.execute({ id: prospect.id, status: "contacted" })}
                className="cursor-pointer rounded-pill border border-graphite px-4 py-2 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-surface"
              >
                {t("send")}
              </a>
            ) : null}

            <select
              value={prospect.status}
              onChange={(event) =>
                setStatus.execute({
                  id: prospect.id,
                  status: event.target.value as ProspectRow["status"] &
                    ("found" | "drafted" | "contacted" | "replied" | "published" | "declined"),
                })
              }
              className="cursor-pointer rounded-pill border border-border bg-surface px-3 py-2 text-sm"
            >
              {["found", "drafted", "contacted", "replied", "published", "declined"].map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </li>
  );
}
