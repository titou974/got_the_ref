import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ADOPTERS_COUNT } from "@/constants/site";
import { SHOWCASE_BRANDS } from "@/constants/brands";

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

/**
 * Preuve sociale compacte : la file des enseignes accompagnées, cinq étoiles,
 * le nombre d'entreprises et le drapeau qui va avec.
 *
 * Les logos viennent de `SHOWCASE_BRANDS` — servis depuis `/public/marques`, et
 * de maquette tant qu'un client n'a pas donné son accord pour figurer ici
 * (cf. l'avertissement du fichier).
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

  return (
    <div
      className={`flex flex-col gap-2.5 ${align === "center" ? "items-center" : "items-start"} ${className}`}
    >
      <ul className="flex -space-x-2.5">
        {SHOWCASE_BRANDS.map((b) => (
          <li
            key={b.name}
            title={b.name}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-snow bg-white shadow-[var(--shadow-md)]"
          >
            <span className="sr-only">{b.name}</span>
            <Image
              src={b.src}
              alt=""
              aria-hidden
              width={64}
              height={64}
              className="h-full w-full object-contain p-0.5"
            />
          </li>
        ))}
      </ul>

      <Stars />

      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted">
        <span>{t("adopters", { count: ADOPTERS_COUNT })}</span>
        <Image
          src="/drapeau-france.png"
          alt=""
          width={20}
          height={20}
          className="inline-block h-5 w-5 shrink-0"
          aria-hidden
        />
        <span className="font-medium text-text">{t("cocorico")}</span>
      </p>
    </div>
  );
}
