import { getTranslations } from "next-intl/server";
import { ADOPTERS_COUNT } from "@/constants/site";
import { TESTIMONIALS } from "@/constants/testimonials";

/** Cinq étoiles pleines, dessinées plutôt qu'importées : une image de moins à charger. */
export function Stars({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-0.5 ${className}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 20 20" fill="#f5a623">
          <path d="M10 1.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />
        </svg>
      ))}
    </div>
  );
}

/** Initiales d'un nom d'enseigne ou de personne : « La Cotriade » → « LC ». */
function initials(name: string) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Preuve sociale compacte : la file des enseignes accompagnées, cinq étoiles,
 * et le nombre d'entreprises. Les pastilles sont des monogrammes dessinés en
 * CSS — les enseignes du ruban de preuves n'ont pas de logo déposé chez nous,
 * et inventer des logos clients serait exactement le genre d'affichage que
 * `PROOF_IS_ILLUSTRATIVE` sert à empêcher.
 */
export async function BrandProof({
  className = "",
  align = "center",
}: {
  className?: string;
  /** `center` sur les sections centrées, `start` dans un en-tête aligné à gauche. */
  align?: "center" | "start";
}) {
  const t = await getTranslations("proof");
  const brands = TESTIMONIALS.slice(0, 6);

  return (
    <div
      className={`flex flex-col gap-2.5 ${align === "center" ? "items-center" : "items-start"} ${className}`}
    >
      <ul className="flex -space-x-2.5">
        {brands.map((b) => (
          <li
            key={b.author}
            title={b.author}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-snow bg-mist text-[11px] font-semibold text-steel shadow-[var(--shadow-md)]"
          >
            {initials(b.author)}
          </li>
        ))}
      </ul>

      <Stars />

      <p className="text-sm text-muted">{t("adopters", { count: ADOPTERS_COUNT })}</p>
    </div>
  );
}
