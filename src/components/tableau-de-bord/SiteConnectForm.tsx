"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { connectSiteAction, disconnectSiteAction } from "@/features/dashboard/actions";
import { connectorFor, type SiteCapability, type SiteConnector } from "@/constants/site-platforms";
import { TextField } from "./Field";
import { SitePlatformPicker } from "./SitePlatformPicker";
import { SiteConnectGuide } from "./SiteConnectGuide";

/**
 * Le rattachement du site, en deux temps.
 *
 * D'abord la plateforme, choisie dans des tuiles ; ensuite le mode d'emploi de
 * cette plateforme et les champs qu'il fait remplir. C'est l'ordre dans lequel
 * le client se pose la question, et cela évite le formulaire nu qui demande un
 * « jeton d'accès Admin » sans dire où le prendre.
 *
 * Il vit à deux endroits : la page des réglages, où il occupe une colonne, et
 * la modale « résoudre avec les agents IA », où le client le rencontre au
 * moment où il en a besoin — juste après avoir vu ce que les agents vont
 * corriger. Le geste ne change pas d'un écran à l'autre, donc le code non plus :
 * `dense` resserre la grille pour la modale, c'est toute la différence.
 *
 * Le formulaire n'est pas écrit plateforme par plateforme : il se construit
 * depuis `constants/site-platforms`, qui dit pour chacune les champs à demander,
 * les droits qu'elle ouvre et si elle est ouverte aux clients. Ajouter un
 * connecteur là-bas suffit à le voir apparaître ici, et à ce que le serveur
 * sache le vérifier.
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

/** Tout ce qu'il faut au formulaire, rassemblé côté serveur en un objet. */
export type SiteConnectSetup = {
  link: SiteLinkView | null;
  /** La plateforme reconnue au crawl, signalée dans les tuiles. */
  suggestedPlatform: string;
  /** L'adresse déjà connue du compte, pour ne pas la faire retaper. */
  suggestedSiteUrl: string | null;
  /** Faux quand `CREDENTIALS_KEY` manque : rien ne peut être chiffré. */
  credentialsKeyReady: boolean;
};

export function SiteConnectForm({
  setup,
  dense = false,
  onConnected,
}: {
  setup: SiteConnectSetup;
  /** Colonne unique : la variante servie dans la modale, large de 28 rem. */
  dense?: boolean;
  /** Appelé après un rattachement accepté, une fois la page rafraîchie. */
  onConnected?: () => void;
}) {
  const { link, suggestedPlatform, suggestedSiteUrl, credentialsKeyReady } = setup;
  const t = useTranslations("dashboard.settings.site");
  const router = useRouter();

  // Nul tant que la plateforme n'est pas choisie : ce sont les tuiles qui
  // s'affichent. Un compte déjà rattaché reprend la sienne — il vient corriger
  // un mot de passe, pas rechoisir son CMS.
  const [platform, setPlatform] = useState<string | null>(link?.platform ?? null);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    siteUrl: link?.siteUrl ?? suggestedSiteUrl ?? "",
  }));

  const connect = useAction(connectSiteAction, {
    onSuccess: ({ data }) => {
      router.refresh();
      if (data?.ok) onConnected?.();
    },
  });
  const disconnect = useAction(disconnectSiteAction, { onSuccess: () => router.refresh() });

  // Changer de plateforme ne garde que l'adresse : un jeton Shopify n'a rien à
  // faire dans un champ WordPress, et le laisser traîner le renverrait au
  // serveur au prochain envoi.
  function choosePlatform(next: string | null) {
    setPlatform(next);
    setValues({ siteUrl: link?.siteUrl ?? suggestedSiteUrl ?? "" });
    connect.reset();
  }

  const set = (name: string) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const connector: SiteConnector | undefined = platform ? connectorFor(platform) : undefined;

  return (
    <>
      {link ? <LinkStatus link={link} /> : null}

      {!credentialsKeyReady ? (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {t("noKey")}
        </p>
      ) : null}

      {connector ? (
        <ConnectFields
          connector={connector}
          hasLink={Boolean(link)}
          values={values}
          set={set}
          dense={dense}
          credentialsKeyReady={credentialsKeyReady}
          connecting={connect.isPending}
          problem={
            connect.result.serverError ??
            (connect.result.data?.ok === false ? connect.result.data.error : null) ??
            null
          }
          onSubmit={(credentials) => connect.execute({ platform: connector.id, credentials })}
          onBack={() => choosePlatform(null)}
          onDisconnect={
            link
              ? () => {
                  if (window.confirm(t("confirmDisconnect"))) disconnect.execute({});
                }
              : undefined
          }
          disconnecting={disconnect.isPending}
        />
      ) : (
        <SitePlatformPicker
          detected={suggestedPlatform}
          dense={dense}
          onPick={choosePlatform}
        />
      )}
    </>
  );
}

/** Le mode d'emploi de la plateforme choisie, puis ses champs. */
function ConnectFields({
  connector,
  hasLink,
  values,
  set,
  dense,
  credentialsKeyReady,
  connecting,
  problem,
  onSubmit,
  onBack,
  onDisconnect,
  disconnecting,
}: {
  connector: SiteConnector;
  hasLink: boolean;
  values: Record<string, string>;
  set: (name: string) => (value: string) => void;
  dense: boolean;
  credentialsKeyReady: boolean;
  connecting: boolean;
  problem: string | null;
  onSubmit: (credentials: Record<string, string>) => void;
  onBack: () => void;
  onDisconnect?: () => void;
  disconnecting: boolean;
}) {
  const t = useTranslations("dashboard.settings.site");

  const missing = connector.fields.some(
    (field) => field.required && !values[field.name]?.trim(),
  );

  const cell = dense ? "col-span-full" : "col-span-full sm:col-span-3";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">
          {t("pickChosen", { name: connector.name })}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-sm font-medium text-graphite underline underline-offset-4 transition-colors duration-200 hover:text-obsidian"
        >
          {t("pickChange")}
        </button>
      </div>

      <SiteConnectGuide connector={connector} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          // Un champ facultatif laissé vide ne part pas : le serveur enregistre
          // les identifiants tels quels, et une chaîne vide y vaudrait un
          // réglage explicite.
          onSubmit(
            Object.fromEntries(
              connector.fields
                .map((field) => [field.name, values[field.name]?.trim() ?? ""] as const)
                .filter(([, value]) => value.length > 0),
            ),
          );
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-6"
      >
        {connector.fields.map((field) => (
          <div key={`${connector.id}.${field.name}`} className={cell}>
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

        <div
          className={`col-span-full flex flex-wrap items-center gap-4 ${dense ? "" : "justify-end"}`}
        >
          {problem ? <p className="mr-auto text-sm text-danger">{problem}</p> : null}

          {onDisconnect ? (
            <button
              type="button"
              disabled={disconnecting}
              onClick={onDisconnect}
              className="cursor-pointer whitespace-nowrap rounded-pill px-4 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist hover:text-obsidian disabled:opacity-60"
            >
              {t("disconnect")}
            </button>
          ) : null}

          <button
            type="submit"
            disabled={connecting || missing || !credentialsKeyReady}
            className={`cursor-pointer whitespace-nowrap rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:opacity-60 ${
              dense ? "flex-1" : ""
            }`}
          >
            {connecting ? t("connecting") : hasLink ? t("reconnect") : t("connect")}
          </button>
        </div>
      </form>
    </div>
  );
}

/** L'état du lien tel qu'il est en base, au-dessus du formulaire. */
export function LinkStatus({ link }: { link: SiteLinkView }) {
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
