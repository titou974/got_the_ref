import { TierGate, TierGatePage } from "./TierGate";
import { offerFor, type DashboardSection } from "@/constants/access";

/**
 * Le verrou d'une section entière du tableau de bord.
 *
 * Composant **serveur**, et ce n'est pas un détail : c'est lui qui décide de ne
 * pas rendre le contenu réel. Un verrou côté client recevrait `children` déjà
 * rendus par le serveur — la donnée voyagerait dans la charge utile de la page,
 * lisible dans le source, et le flou ne serait qu'un maquillage. Ici, le vrai
 * contenu n'est simplement jamais rendu : rien à retrouver en désactivant une
 * classe CSS.
 *
 * Ce qui passe sous le voile est donc une maquette — la forme de ce qui attend,
 * sans une valeur du client. C'est ce que le voile a toujours voulu montrer :
 * un tableau, une courbe, une grille de contrôles. Il le montre maintenant sans
 * rien donner.
 *
 * Deux tailles, parce que toutes les sections ne se ferment pas en bloc. Une
 * page entière verrouillée (structure, présence, Maps) prend le grand voile ;
 * un seul bloc au milieu d'une page ouverte — la demande de planning et la voix
 * de marque, sur l'onglet Articles, où les sujets restent en clair — prend le
 * voile compact, sans hauteur imposée.
 */
export function SectionGate({
  section,
  locked,
  compact = false,
  children,
}: {
  /** La section verrouillée : elle donne l'offre à vendre et le texte du voile. */
  section: DashboardSection;
  locked: boolean;
  /** Voile d'un bloc posé dans une page ouverte, plutôt que de la page entière. */
  compact?: boolean;
  /** Le contenu réel, rendu seulement si la section est ouverte. */
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;

  const offer = offerFor(section);

  if (compact) {
    return (
      <TierGate offer={offer} item={section} compact className="mt-4">
        <BlockPreview />
      </TierGate>
    );
  }

  return (
    <TierGatePage offer={offer} item={section}>
      <SectionPreview />
    </TierGatePage>
  );
}

/** La maquette d'un bloc isolé : une carte, un bouton, une jauge. */
function BlockPreview() {
  return (
    <div aria-hidden className="rounded-[28px] border border-fog bg-snow p-6">
      <Bar className="h-4 w-1/3" />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="h-10 w-44 rounded-pill bg-mist" />
        <span className="h-10 w-32 rounded-pill bg-mist" />
      </div>
      <Bar className="mt-5 h-3 w-full" />
      <Bar className="mt-2 h-3 w-2/3" />
    </div>
  );
}

/**
 * La maquette posée sous le voile : des cartes, une grille, quelques lignes.
 * Aucune donnée, aucune traduction — elle n'est jamais lisible, seulement
 * reconnaissable.
 */
function SectionPreview() {
  return (
    <div aria-hidden className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-[28px] border border-fog bg-snow p-6 lg:col-span-2">
        <div className="flex items-center gap-5">
          <span className="h-[110px] w-[110px] shrink-0 rounded-full border-[12px] border-mist" />
          <div className="flex-1 space-y-3">
            <Bar className="h-4 w-1/3" />
            <Bar className="h-3 w-4/5" />
            <Bar className="h-3 w-2/3" />
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-fog bg-snow p-6">
        <Bar className="h-4 w-1/2" />
        <div className="mt-5 space-y-3">
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-5/6" />
          <Bar className="h-3 w-3/4" />
          <Bar className="h-3 w-2/3" />
        </div>
      </div>

      <div className="rounded-[28px] border border-fog bg-snow p-6 lg:col-span-3">
        <Bar className="h-4 w-1/4" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-mist p-4">
              <Bar className="h-3 w-2/3" />
              <Bar className="mt-3 h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-full bg-mist ${className}`} />;
}
