"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { connectSiteAction, disconnectSiteAction } from "@/features/dashboard/actions";
import {
  SITE_CONNECTORS,
  connectorFor,
  type SiteCapability,
  type SiteConnector,
} from "@/constants/site-platforms";
import { TextField, SelectField } from "./Field";

/**
 * Le rattachement du site du client, depuis les réglages.
 *
 * Tout ce qui suit — vérifier les identifiants, publier, corriger les textes,
 * dérouler le planning sans personne devant l'écran — existait déjà côté
 * serveur et n'avait aucune porte d'entrée. C'est celle-ci.
 *
 * Le formulaire n'est pas écrit plateforme par plateforme : il se construit
 * depuis `constants/site-platforms`, qui dit pour chacune les champs à demander
 * et les droits qu'elle ouvre. Ajouter un connecteur là-bas suffit à le voir
 * apparaître ici, et à ce que le serveur sache le vérifier.
 *
 * Deux règles tiennent l'écran :
 *
 *   — un secret ne revient jamais du serveur. Le champ est vide même pour un
 *     lien qui marche, et la phrase sous le champ le dit plutôt que d'afficher
 *     des points qui laisseraient croire à une valeur relue ;
 *   — on n'annonce que ce que la plateforme a réellement accordé. Les droits
 *     affichés sont ceux que l'appel d'essai a constatés, pas ceux que le
 *     registre espérait : une boutique Shopify sans blog est rattachée, et on
 *     lui dit que ses articles resteront à déposer à la main.
 */

export type SiteLinkView = {
  platform: string;
  siteUrl: string | null;
  status: string;
  capabilities: SiteCapability[];
  /** Déjà mis en forme côté serveur : le fuseau du serveur fait foi. */
  connectedOn: string | null;
  lastError: string | null;
};

export function SiteConnectionPanel({
  link,
  suggestedPlatform,
  suggestedSiteUrl,
  credentialsKeyReady,
}: {
  link: SiteLinkView | null;
  /** La plateforme reconnue au crawl, proposée d'emblée. */
  suggestedPlatform: string;
  /** L'adresse déjà connue du compte, pour ne pas la faire retaper. */
  suggestedSiteUrl: string | null;
  /** Faux quand `CREDENTIALS_KEY` manque : rien ne peut être chiffré. */
  credentialsKeyReady: boolean;
}) {
  const t = useTranslations("dashboard.settings.site");
  const router = useRouter();

  const [platform, setPlatform] = useState(link?.platform ?? suggestedPlatform);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    siteUrl: link?.siteUrl ?? suggestedSiteUrl ?? "",
  }));

  const connect = useAction(connectSiteAction, { onSuccess: () => router.refresh() });
  const disconnect = useAction(disconnectSiteAction, { onSuccess: () => router.refresh() });

  const connector: SiteConnector = connectorFor(platform) ?? SITE_CONNECTORS[0];

  // Changer de plateforme ne garde que l'adresse : un jeton Shopify n'a rien à
  // faire dans un champ WordPress, et le laisser traîner le renverrait au
  // serveur au prochain envoi.
  function choosePlatform(next: string) {
    setPlatform(next);
    setValues((current) => ({ siteUrl: current.siteUrl ?? "" }));
  }

  const set = (name: string) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const missing = connector.fields.some(
    (field) => field.required && !values[field.name]?.trim(),
  );

  // Le refus d'une plateforme revient dans la réponse, pas en exception : un
  // mot de passe faux n'est pas une panne du serveur.
  const refusal = connect.result.data?.ok === false ? connect.result.data.error : null;
  const problem = connect.result.serverError ?? refusal ?? null;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{t("body")}</p>
        {connector.docsUrl ? (
          <a
            href={connector.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-block text-sm font-medium text-graphite underline underline-offset-4 transition-colors duration-200 hover:text-obsidian"
          >
            {t("docs")}
          </a>
        ) : null}
      </div>

      <div className="md:col-span-2">
        {link ? <LinkStatus link={link} /> : null}

        {!credentialsKeyReady ? (
          <p className="mb-4 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
            {t("noKey")}
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Un champ facultatif laissé vide ne part pas : le serveur
            // enregistre les identifiants tels quels, et une chaîne vide y
            // vaudrait un réglage explicite.
            const credentials = Object.fromEntries(
              connector.fields
                .map((field) => [field.name, values[field.name]?.trim() ?? ""] as const)
                .filter(([, value]) => value.length > 0),
            );
            connect.execute({ platform: connector.id, credentials });
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-6"
        >
          <div className="col-span-full sm:col-span-3">
            <SelectField
              name="platform"
              label={t("platform")}
              value={platform}
              onChange={(event) => choosePlatform(event.target.value)}
              options={SITE_CONNECTORS.map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
            />
          </div>

          {connector.fields.map((field) => (
            <div key={`${connector.id}.${field.name}`} className="col-span-full sm:col-span-3">
              <TextField
                name={field.name}
                label={label(t, field.name)}
                type={field.kind === "secret" ? "password" : field.kind === "url" ? "url" : "text"}
                value={values[field.name] ?? ""}
                onChange={(event) => set(field.name)(event.target.value)}
                placeholder={optional(t, field.name, "placeholder")}
                hint={
                  field.kind === "secret"
                    ? [optional(t, field.name, "hint"), t("secretHint")].filter(Boolean).join(" ")
                    : optional(t, field.name, "hint")
                }
                autoComplete="off"
                spellCheck={false}
                required={field.required}
              />
            </div>
          ))}

          <div className="col-span-full flex flex-wrap items-center justify-end gap-4">
            {problem ? <p className="mr-auto text-sm text-danger">{problem}</p> : null}

            {link ? (
              <button
                type="button"
                disabled={disconnect.isPending}
                onClick={() => {
                  if (window.confirm(t("confirmDisconnect"))) disconnect.execute({});
                }}
                className="cursor-pointer whitespace-nowrap rounded-pill px-4 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist hover:text-obsidian disabled:opacity-60"
              >
                {t("disconnect")}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={connect.isPending || missing || !credentialsKeyReady}
              className="cursor-pointer whitespace-nowrap rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:opacity-60"
            >
              {connect.isPending ? t("connecting") : link ? t("reconnect") : t("connect")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** L'état du lien tel qu'il est en base, au-dessus du formulaire. */
function LinkStatus({ link }: { link: SiteLinkView }) {
  const t = useTranslations("dashboard.settings.site");
  const connected = link.status === "connected";
  const canPublish = link.capabilities.includes("publish");

  return (
    <div className="mb-6 rounded-2xl border border-border bg-mist/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${
            connected ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {connected
            ? t("statusConnected")
            : link.status === "error"
              ? t("statusError")
              : t("statusPending")}
        </span>
        {link.siteUrl ? (
          <span className="truncate text-sm text-graphite">{link.siteUrl}</span>
        ) : null}
      </div>

      {connected ? (
        <p className="mt-2 text-sm text-muted">
          {canPublish ? t("canPublish") : t("canEditOnly")}
          {link.connectedOn ? ` ${t("connectedOn", { date: link.connectedOn })}` : null}
        </p>
      ) : null}

      {link.lastError ? <p className="mt-2 text-sm text-danger">{link.lastError}</p> : null}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<"dashboard.settings.site">>;

/**
 * Le libellé d'un champ. Un connecteur peut nommer un champ que les textes ne
 * connaissent pas encore : mieux vaut afficher son nom brut qu'une page qui
 * refuse de se rendre.
 */
function label(t: Translate, name: string): string {
  const key = `fields.${name}.label`;
  return t.has(key) ? t(key) : name;
}

/** Une aide ou un exemple, quand les textes en prévoient un pour ce champ. */
function optional(t: Translate, name: string, kind: "hint" | "placeholder"): string | undefined {
  const key = `fields.${name}.${kind}`;
  return t.has(key) ? t(key) : undefined;
}
