"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  SITE_CONNECTORS,
  connectorFor,
  type SiteCapability,
} from "@/constants/site-platforms";
import { connectSiteAction, disconnectSiteAction } from "@/features/dashboard/actions";
import { Section, SelectField, TextField } from "./Field";
import { CredentialGuide } from "./CredentialGuide";
import { StatusDot } from "./Card";

/**
 * Le rattachement du site, de bout en bout : choisir sa plateforme, donner ses
 * identifiants, savoir ce que le lien ouvre.
 *
 * Le formulaire se construit depuis `constants/site-platforms` plutôt que d'une
 * variante par plateforme : chaque connecteur déclare ses champs, et un champ
 * `secret` se masque tout seul. Ajouter Ghost ou Webflow ne demande rien ici.
 *
 * Un lien vivant n'affiche pas de formulaire. Le client voit d'abord ce qu'il a
 * accordé — publier, corriger — et les deux gestes qui comptent alors : refaire
 * le rattachement, ou le retirer. Les identifiants ne redescendent jamais du
 * serveur : on ne remplit pas un champ mot de passe avec des points qui
 * mentiraient sur ce qui est enregistré.
 *
 * L'échec de vérification ne remonte pas en erreur serveur mais en réponse :
 * `connectSiteAction` renvoie `{ ok: false, error }` et conserve l'ancien lien.
 * Un mot de passe mal recopié ne doit pas défaire un rattachement qui marchait.
 */

type Connection = {
  platform: string;
  siteUrl: string | null;
  status: string;
  capabilities: string[];
  connectedAt: string | null;
  lastError: string | null;
};

export function SiteConnectionForm({
  connection,
  suggestedPlatform,
}: {
  connection: Connection | null;
  /** La plateforme reconnue au crawl, proposée d'emblée. */
  suggestedPlatform: string;
}) {
  const t = useTranslations("dashboard.connect");
  const router = useRouter();

  const linked = connection?.status === "connected";
  const [editing, setEditing] = useState(!linked);
  const [platform, setPlatform] = useState(
    connection?.platform ?? (connectorFor(suggestedPlatform) ? suggestedPlatform : "wordpress"),
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const connect = useAction(connectSiteAction, {
    onSuccess: ({ data }) => {
      if (!data?.ok) return;
      setCredentials({});
      setEditing(false);
      router.refresh();
    },
  });
  const disconnect = useAction(disconnectSiteAction, {
    onSuccess: () => {
      setCredentials({});
      setEditing(true);
      router.refresh();
    },
  });

  const connector = useMemo(() => connectorFor(platform), [platform]);

  /** Le premier champ secret : c'est lui que le guide précède. */
  const firstSecret = connector?.fields.find((field) => field.kind === "secret")?.name ?? null;

  const rights = (capabilities: string[]) =>
    capabilities.length === 0
      ? t("rights.none")
      : capabilities
          .map((capability) => t(`rights.${capability as SiteCapability}`))
          .join(t("rights.join"));

  // Une vérification refusée revient dans `data`, une panne serveur dans
  // `serverError` : les deux se lisent au même endroit, sous le formulaire.
  const refused = connect.result.data?.ok === false ? connect.result.data.error : null;
  const failed = connect.result.serverError ?? refused ?? null;

  if (linked && !editing) {
    return (
      <Section title={t("panel.title")} body={t("panel.body")}>
        <div className="col-span-full">
          <div className="rounded-2xl border border-border bg-mist/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusDot status="ok" />
              <span className="text-sm font-medium text-ink">
                {connectorFor(connection.platform)?.name ?? connection.platform}
              </span>
              {connection.siteUrl ? (
                <span className="truncate text-sm text-muted">{connection.siteUrl}</span>
              ) : null}
            </div>

            <p className="mt-2 text-sm leading-6 text-graphite">
              {t("panel.rightsOpen", { rights: rights(connection.capabilities) })}
            </p>
            {connection.connectedAt ? (
              <p className="mt-1 text-xs text-muted">
                {t("panel.connectedSince", { date: connection.connectedAt })}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
            >
              {t("panel.edit")}
            </button>
            <button
              type="button"
              onClick={() => disconnect.execute({})}
              disabled={disconnect.isPending}
              className="cursor-pointer rounded-pill px-4 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist hover:text-obsidian disabled:opacity-60"
            >
              {disconnect.isPending ? t("panel.removing") : t("panel.remove")}
            </button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        connect.execute({ platform, credentials });
      }}
    >
      <Section title={t("panel.title")} body={t("panel.body")}>
        <div className="col-span-full sm:col-span-3">
          <SelectField
            name="platform"
            label={t("form.platform")}
            value={platform}
            onChange={(event) => {
              setPlatform(event.target.value);
              // Les champs changent d'une plateforme à l'autre : garder les
              // anciennes valeurs enverrait un jeton Shopify dans un champ
              // WordPress.
              setCredentials({});
            }}
            options={SITE_CONNECTORS.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>

        {connector?.docsUrl ? (
          <div className="col-span-full flex items-end sm:col-span-3">
            <a
              href={connector.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="pb-2.5 text-sm font-medium text-graphite underline underline-offset-4 transition-colors duration-200 hover:text-obsidian"
            >
              {t("form.docs")}
            </a>
          </div>
        ) : null}

        {connector?.fields.map((field) => (
          <div key={field.name} className="col-span-full">
            {field.name === firstSecret ? (
              <div className="mb-4">
                <CredentialGuide platform={platform} />
              </div>
            ) : null}

            <TextField
              name={field.name}
              label={
                field.required
                  ? t(`fields.${field.name}`)
                  : `${t(`fields.${field.name}`)} ${t("form.optional")}`
              }
              type={field.kind === "secret" ? "password" : field.kind === "url" ? "url" : "text"}
              autoComplete="off"
              spellCheck={false}
              required={field.required}
              value={credentials[field.name] ?? ""}
              onChange={(event) =>
                setCredentials((current) => ({ ...current, [field.name]: event.target.value }))
              }
              placeholder={t(`placeholders.${field.name}`)}
            />
          </div>
        ))}

        <div className="col-span-full">
          <p className="text-sm leading-6 text-muted">
            {t("panel.rightsOpen", { rights: rights(connector?.capabilities ?? []) })}
          </p>
        </div>

        <div className="col-span-full flex flex-wrap items-center justify-end gap-4">
          {failed ? <p className="mr-auto text-sm text-danger">{failed}</p> : null}

          {linked ? (
            <button
              type="button"
              onClick={() => {
                setCredentials({});
                setEditing(false);
              }}
              className="cursor-pointer rounded-pill px-4 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist hover:text-obsidian"
            >
              {t("form.cancel")}
            </button>
          ) : null}

          <button
            type="submit"
            disabled={connect.isPending}
            className="cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:opacity-60"
          >
            {connect.isPending ? t("form.checking") : t("panel.submit")}
          </button>
        </div>
      </Section>
    </form>
  );
}
