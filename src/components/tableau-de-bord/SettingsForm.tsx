"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { saveSettingsAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/constants/routes";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { SignOutButton } from "@/components/SignOutButton";
import { AreaField, Divider, SelectField, TextField } from "./Field";

/**
 * L'écran de réglages, sur le patron du bloc « settings » de Tremor : à gauche
 * le titre de section et sa phrase d'explication, à droite les champs sur une
 * grille de six colonnes, un trait entre chaque section, et les deux boutons en
 * bas à droite.
 *
 * Trois écarts avec le bloc d'origine, tous dictés par ce qui existe vraiment
 * derrière :
 *
 *   — le bloc réglait un « espace de travail » ; ici, un compte suit un
 *     commerce, donc la deuxième section est la fiche de ce commerce, celle que
 *     les agents relisent avant chaque rédaction ;
 *   — sa troisième section réglait la fréquence d'une infolettre. Aucune n'est
 *     envoyée : trois boutons radio qui n'écrivent nulle part se liraient comme
 *     un réglage, pas comme un décor. La place revient au ton éditorial, qui,
 *     lui, change le texte produit ;
 *   — l'adresse e-mail et la formule restent en lecture seule. Changer la
 *     première déplace la clé de connexion, la seconde passe par Stripe : le
 *     bouton du portail est juste à côté plutôt qu'un champ qui mentirait.
 */
export function SettingsForm({
  name,
  email,
  planLabel,
  businessKind,
  niche,
  targetMarket,
  description,
  audience,
  toneInstructions,
  toneBanned,
}: {
  name: string;
  email: string;
  planLabel: string;
  businessKind: "" | "physical" | "online" | "both";
  niche: string;
  targetMarket: string;
  description: string;
  audience: string;
  toneInstructions: string;
  toneBanned: string[];
}) {
  const t = useTranslations("dashboard.settings");
  const router = useRouter();
  const { execute, isPending, result } = useAction(saveSettingsAction);

  const [form, setForm] = useState({
    name,
    businessKind,
    niche,
    targetMarket,
    description,
    audience,
    toneInstructions,
    toneBanned: toneBanned.join("\n"),
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const errors = result.validationErrors as
    | Record<string, { _errors?: string[] } | undefined>
    | undefined;
  const errorFor = (field: string) => errors?.[field]?._errors?.[0];
  const saved = Boolean(result.data?.ok) && !isPending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        execute({
          ...form,
          businessKind: form.businessKind as "" | "physical" | "online" | "both",
          toneBanned: form.toneBanned
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        });
      }}
    >
      <Section title={t("identity.title")} body={t("identity.body")}>
        <div className="col-span-full sm:col-span-3">
          <TextField
            name="name"
            label={t("identity.name")}
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            autoComplete="name"
            error={errorFor("name")}
          />
        </div>
        <div className="col-span-full sm:col-span-3">
          <TextField
            name="email"
            label={t("identity.email")}
            type="email"
            value={email}
            readOnly
            disabled
            hint={t("identity.emailHint")}
          />
        </div>
        <div className="col-span-full sm:col-span-3">
          <TextField name="plan" label={t("identity.plan")} value={planLabel} readOnly disabled />
          <div className="mt-2">
            <BillingPortalButton
              label={t("identity.billing")}
              className="cursor-pointer text-sm font-medium text-graphite underline underline-offset-4 transition-colors duration-200 hover:text-obsidian disabled:opacity-60"
            />
          </div>
        </div>

        {/* La déconnexion se cherche ici. La colonne de gauche ne la porte
            plus, et le tableau de bord n'a pas le pied de page du site public :
            sans cette ligne, il n'y avait aucun moyen de quitter la session.
            Elle ferme la section du compte, sous le nom et l'adresse qu'elle
            concerne, en retrait du bouton qui enregistre. */}
        <div className="col-span-full border-t border-border pt-4">
          <SignOutButton className="font-medium underline underline-offset-4 hover:text-obsidian" />
        </div>
      </Section>

      <Divider className="my-12" />

      <Section title={t("business.title")} body={t("business.body")}>
        <div className="col-span-full sm:col-span-3">
          <TextField
            name="niche"
            label={t("business.niche")}
            value={form.niche}
            onChange={(event) => set("niche")(event.target.value)}
            placeholder={t("business.nichePlaceholder")}
            error={errorFor("niche")}
          />
        </div>
        <div className="col-span-full sm:col-span-3">
          <TextField
            name="targetMarket"
            label={t("business.market")}
            value={form.targetMarket}
            onChange={(event) => set("targetMarket")(event.target.value)}
            placeholder={t("business.marketPlaceholder")}
            error={errorFor("targetMarket")}
          />
        </div>
        <div className="col-span-full sm:col-span-3">
          {/* Ce choix retire ou remet l'onglet Google Maps : une activité
              uniquement en ligne n'a pas de fiche à surveiller. */}
          <SelectField
            name="businessKind"
            label={t("business.kind")}
            value={form.businessKind}
            onChange={(event) => set("businessKind")(event.target.value)}
            options={[
              { value: "", label: t("business.kindUnset") },
              { value: "physical", label: t("business.kindPhysical") },
              { value: "online", label: t("business.kindOnline") },
              { value: "both", label: t("business.kindBoth") },
            ]}
            hint={t("business.kindHint")}
            error={errorFor("businessKind")}
          />
        </div>
        <div className="col-span-full">
          <AreaField
            name="description"
            label={t("business.description")}
            rows={4}
            value={form.description}
            onChange={(event) => set("description")(event.target.value)}
            placeholder={t("business.descriptionPlaceholder")}
            hint={t("business.descriptionHint")}
            error={errorFor("description")}
          />
        </div>
        <div className="col-span-full">
          <AreaField
            name="audience"
            label={t("business.audience")}
            rows={3}
            value={form.audience}
            onChange={(event) => set("audience")(event.target.value)}
            placeholder={t("business.audiencePlaceholder")}
            error={errorFor("audience")}
          />
        </div>
      </Section>

      <Divider className="my-12" />

      <Section title={t("tone.title")} body={t("tone.body")}>
        <div className="col-span-full">
          <AreaField
            name="toneInstructions"
            label={t("tone.instructions")}
            rows={4}
            value={form.toneInstructions}
            onChange={(event) => set("toneInstructions")(event.target.value)}
            placeholder={t("tone.instructionsPlaceholder")}
            hint={t("tone.instructionsHint")}
            error={errorFor("toneInstructions")}
          />
        </div>
        <div className="col-span-full">
          <AreaField
            name="toneBanned"
            label={t("tone.banned")}
            rows={3}
            value={form.toneBanned}
            onChange={(event) => set("toneBanned")(event.target.value)}
            placeholder={t("tone.bannedPlaceholder")}
            hint={t("tone.bannedHint")}
          />
        </div>
      </Section>

      <Divider className="my-12" />

      <div className="flex flex-wrap items-center justify-end gap-4">
        {result.serverError ? (
          <p className="mr-auto text-sm text-danger">{result.serverError}</p>
        ) : saved ? (
          <p className="mr-auto text-sm text-success">{t("saved")}</p>
        ) : null}

        <button
          type="button"
          onClick={() => router.push(ROUTES.dashboard)}
          className="cursor-pointer whitespace-nowrap rounded-pill px-4 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist hover:text-obsidian"
        >
          {t("back")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer whitespace-nowrap rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:opacity-60"
        >
          {isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}

/** Un bloc du formulaire : l'intitulé à gauche, les champs à droite. */
function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
      </div>
      <div className="md:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">{children}</div>
      </div>
    </div>
  );
}
