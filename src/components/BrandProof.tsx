import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ADOPTERS_COUNT } from "@/constants/site";
import { SHOWCASE_BRANDS, type BrandGlyph } from "@/constants/brands";

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

/** Le dessin d'une enseigne : un trait, jamais un aplat — ça reste lisible à 36 px. */
function Glyph({ glyph }: { glyph: BrandGlyph }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (glyph) {
    case "croissant":
      return (
        <svg {...common}>
          <path d="M5 15c3.5 3.5 10.5 3.5 14 0-2-1-3.5-3-4-5.5C14 7 12 5.5 9.5 5.5 7 5.5 5 7.5 5 10z" />
          <path d="M8.5 13.5c1.5 1 4.5 1.4 7 .3" />
        </svg>
      );
    case "outil":
      return (
        <svg {...common}>
          <path d="M14.5 4.5a4 4 0 0 0-4.7 5.2L4 15.5 8.5 20l5.8-5.8a4 4 0 0 0 5.2-4.7l-2.6 2.6-2.5-.7-.7-2.5z" />
        </svg>
      );
    case "tasse":
      return (
        <svg {...common}>
          <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
          <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M8 3.5c-.6 1 .6 1.8 0 2.8M11.5 3.5c-.6 1 .6 1.8 0 2.8" />
        </svg>
      );
    case "feuille":
      return (
        <svg {...common}>
          <path d="M5 19c0-7 4.5-11 14-11 0 8-4 12-9.5 12A4.5 4.5 0 0 1 5 19z" />
          <path d="M9 15.5c2-2.5 4.5-4.2 7.5-5.2" />
        </svg>
      );
    case "roue":
      return (
        <svg {...common}>
          <circle cx="6.5" cy="16" r="4" />
          <circle cx="17.5" cy="16" r="4" />
          <path d="M6.5 16 11 7h4l2.5 9M9 7h4" />
        </svg>
      );
    case "losange":
      return (
        <svg {...common}>
          <path d="M12 3.5 20 12l-8 8.5L4 12z" />
          <path d="M8.5 12 12 8.5l3.5 3.5-3.5 3.5z" />
        </svg>
      );
  }
}

/**
 * Preuve sociale compacte : la file des enseignes accompagnées, cinq étoiles,
 * le nombre d'entreprises et le drapeau qui va avec.
 *
 * Les logos viennent de `SHOWCASE_BRANDS` — génériques tant qu'aucun client
 * n'a donné son accord pour figurer ici (cf. l'avertissement du fichier).
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
            style={{ backgroundColor: b.tint }}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-snow text-graphite shadow-[var(--shadow-md)]"
          >
            <span className="sr-only">{b.name}</span>
            <Glyph glyph={b.glyph} />
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
