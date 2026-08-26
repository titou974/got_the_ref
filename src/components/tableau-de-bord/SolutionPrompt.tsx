import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { writeSolutionPrompt } from "@/features/dashboard/solution-prompt";
import type { SolutionFactsInput } from "@/lib/geo/solution-facts";
import { Card, CardTitle } from "./Card";
import { PromptCard } from "./PromptCard";

/**
 * La carte de prompt, remplie par le modèle mini.
 *
 * L'appel prend deux à trois secondes : derrière une frontière `Suspense`, la
 * page s'affiche entière et le prompt arrive après, à sa place, sans faire
 * attendre le reste de l'écran.
 */
export function SolutionPrompt(input: SolutionFactsInput) {
  return (
    <Suspense fallback={<SolutionPromptSkeleton />}>
      <WrittenPrompt {...input} />
    </Suspense>
  );
}

async function WrittenPrompt(input: SolutionFactsInput) {
  return <PromptCard prompt={await writeSolutionPrompt(input)} />;
}

async function SolutionPromptSkeleton() {
  const t = await getTranslations("dashboard.prompt");

  return (
    <Card>
      <CardTitle title={t("title")} hint={t("writing")} />
      <div className="space-y-2" aria-hidden>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-full bg-mist"
            style={{ width: `${[92, 78, 86, 54][i]}%` }}
          />
        ))}
      </div>
    </Card>
  );
}
