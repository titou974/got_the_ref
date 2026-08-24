"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { SITE_CONNECTORS, connectorFor } from "@/constants/site-platforms";
import { connectSiteAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/constants/routes";
import type { SiteLink } from "@/features/dashboard/queries";

/**
 * Les deux rattachements, en tête du tableau de bord.
 *
 * Analytics d'abord : sans lui, aucun chiffre de trafic venu des IA, et la page
 * d'accueil se réduit à des états. Le site ensuite : c'est lui qui transforme
 * une recommandation en correction appliquée.
 *
 * Les deux cartes restent affichées une fois rattachées, en version courte :
 * un lien qui disparaît une fois branché laisse le client sans moyen de le
 * refaire le jour où il casse.
 */

const cardClass =
  "flex flex-col gap-3 rounded-[28px] border border-border bg-surface p-5 sm:p-6";

export function ConnectStrip({
  analyticsConnected,
  propertyName,
  site,
  suggestedPlatform,
}: {
  analyticsConnected: boolean;
  propertyName: string | null;
  site: SiteLink | null;
  /** Plateforme reconnue au crawl : le formulaire s'ouvre dessus. */
  suggestedPlatform: string;
}) {
  const t = useTranslations("dashboard.connect");
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("analytics.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("analytics.body")}</p>
          </div>
          <StatusPill ok={analyticsConnected} labelOk={t("connected")} labelKo={t("notConnected")} />
        </div>

        {analyticsConnected ? (
          <p className="text-sm text-muted">
            {t("analytics.property", { name: propertyName ?? t("analytics.unnamedProperty") })}
          </p>
        ) : (
          <p className="text-sm text-muted">{t("analytics.detail")}</p>
        )}

        <a
          href={`/api/google/connect?suite=${encodeURIComponent(ROUTES.dashboard)}`}
          className={
            analyticsConnected
              ? "cursor-pointer self-start text-sm font-medium text-text underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              : "inline-flex cursor-pointer items-center justify-center self-start rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
          }
        >
          {analyticsConnected ? t("analytics.again") : t("analytics.cta")}
        </a>
      </div>

      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("site.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("site.body")}</p>
          </div>
          <StatusPill
            ok={site?.status === "connected"}
            labelOk={t("connected")}
            labelKo={t("notConnected")}
          />
        </div>

        {site?.status === "connected" ? (
          <p className="text-sm text-muted">
            {t("site.linked", {
              platform: connectorFor(site.platform)?.name ?? site.platform,
              rights: site.capabilities.map((c) => t(`rights.${c}`)).join(", ") || t("rights.none"),
            })}
          </p>
        ) : (
          <p className="text-sm text-muted">{t("site.detail")}</p>
        )}

        {site?.lastError ? <p className="text-sm text-danger">{site.lastError}</p> : null}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={
            site?.status === "connected"
              ? "cursor-pointer self-start text-sm font-medium text-text underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              : "inline-flex cursor-pointer items-center justify-center self-start rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
          }
        >
          {site?.status === "connected" ? t("site.again") : t("site.cta")}
        </button>

        {open ? (
          <ConnectForm
            initialPlatform={site?.platform ?? suggestedPlatform}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ ok, labelOk, labelKo }: { ok: boolean; labelOk: string; labelKo: string }) {
  return (
    <span
      className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
        ok ? "bg-success/10 text-success" : "bg-mist text-steel"
      }`}
    >
      {ok ? labelOk : labelKo}
    </span>
  );
}

function ConnectForm({
  initialPlatform,
  onDone,
}: {
  initialPlatform: string;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.connect");
  const [platform, setPlatform] = useState(initialPlatform);
  const [values, setValues] = useState<Record<string, string>>({});
  const { execute, result, isPending } = useAction(connectSiteAction, {
    onSuccess: ({ data }) => {
      if (data?.ok) onDone();
    },
  });

  const connector = connectorFor(platform) ?? SITE_CONNECTORS[0];

  return (
    <form
      className="mt-1 space-y-3 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        execute({ platform: connector.id, credentials: values });
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t("form.platform")}</span>
        <select
          value={platform}
          onChange={(event) => {
            setPlatform(event.target.value);
            setValues({});
          }}
          className="w-full cursor-pointer rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm"
        >
          {SITE_CONNECTORS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      {connector.fields.map((field) => (
        <label key={field.name} className="block">
          <span className="mb-1 block text-sm font-medium">
            {t(`fields.${field.name}`)}
            {field.required ? "" : ` ${t("form.optional")}`}
          </span>
          <input
            type={field.kind === "secret" ? "password" : field.kind === "url" ? "url" : "text"}
            value={values[field.name] ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.name]: event.target.value }))
            }
            required={field.required}
            autoComplete="off"
            className="w-full rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm"
          />
        </label>
      ))}

      <p className="text-xs text-muted">
        {t("form.rights", {
          rights: connector.capabilities.map((c) => t(`rights.${c}`)).join(", "),
        })}
        {connector.docsUrl ? (
          <>
            {" "}
            <a
              href={connector.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer underline decoration-pebble underline-offset-2 hover:decoration-obsidian"
            >
              {t("form.docs")}
            </a>
          </>
        ) : null}
      </p>

      {result.serverError ? <p className="text-sm text-danger">{result.serverError}</p> : null}
      {result.data && !result.data.ok ? (
        <p className="text-sm text-danger">{result.data.error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex cursor-pointer items-center justify-center rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
        >
          {isPending ? t("form.checking") : t("form.submit")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="cursor-pointer rounded-pill border border-graphite px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
        >
          {t("form.cancel")}
        </button>
      </div>
    </form>
  );
}
