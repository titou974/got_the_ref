"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { saveBrandVoiceAction } from "@/features/dashboard/actions";
import { Card, CardTitle } from "./Card";

/**
 * La voix de la marque, écrite une fois et relue à chaque rédaction.
 *
 * Ce que le client corrige ici ne s'applique pas rétroactivement aux articles
 * déjà rédigés : il faut en redemander une version. C'est dit sous le champ,
 * sinon la consigne semblerait sans effet.
 */
export function BrandVoicePanel({
  instructions,
  banned,
}: {
  instructions: string;
  banned: string[];
}) {
  const t = useTranslations("dashboard.voice");
  const [value, setValue] = useState(instructions);
  const [bannedText, setBannedText] = useState(banned.join("\n"));
  const { execute, isPending, result } = useAction(saveBrandVoiceAction);

  const saved = Boolean(result.data?.ok) && !isPending;

  return (
    <Card>
      <CardTitle title={t("title")} hint={t("hint")} />

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          execute({
            instructions: value,
            banned: bannedText
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          });
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("instructions")}</span>
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={4}
            placeholder={t("placeholder")}
            className="w-full rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("banned")}</span>
          <textarea
            value={bannedText}
            onChange={(event) => setBannedText(event.target.value)}
            rows={3}
            placeholder={t("bannedPlaceholder")}
            className="w-full rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">{t("bannedHelp")}</span>
        </label>

        {result.serverError ? <p className="text-sm text-danger">{result.serverError}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex cursor-pointer items-center rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
          >
            {isPending ? t("saving") : t("save")}
          </button>
          {saved ? <span className="text-sm text-success">{t("saved")}</span> : null}
        </div>

        <p className="text-xs text-muted">{t("scope")}</p>
      </form>
    </Card>
  );
}
