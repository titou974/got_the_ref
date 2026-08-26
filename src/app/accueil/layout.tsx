import { CrispChat } from "@/components/CrispChat";

/**
 * La coque du tunnel d'accueil — elle n'ajoute aucun décor.
 *
 * `OnboardingShell` porte déjà la mise en page de chaque étape. Ce layout
 * n'existe que pour monter la bulle de discussion une seule fois, sur les sept
 * étapes : c'est le moment où le client bute sur une question (« mon domaine,
 * avec ou sans www ? ») et où une réponse humaine évite un abandon.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CrispChat />
      {children}
    </>
  );
}
