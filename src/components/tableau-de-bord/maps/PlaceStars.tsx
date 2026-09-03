import { RiStarFill, RiStarHalfSFill, RiStarLine } from "@remixicon/react";
import { starShapes } from "./place-format";

/**
 * Les cinq étoiles d'une note, dans l'or de Google.
 *
 * Purement décoratives : la note chiffrée est toujours écrite à côté, et un
 * lecteur d'écran n'a rien à gagner à entendre « étoile » cinq fois.
 */
export function PlaceStars({
  rating,
  size = 16,
  className = "",
}: {
  rating: number | null;
  size?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={`inline-flex items-center gap-px ${className}`}>
      {starShapes(rating).map((shape, index) => {
        const key = `star-${index}`;
        if (shape === "full") {
          return <RiStarFill key={key} size={size} className="text-[var(--gm-star)]" />;
        }
        if (shape === "half") {
          return <RiStarHalfSFill key={key} size={size} className="text-[var(--gm-star)]" />;
        }
        return <RiStarLine key={key} size={size} className="text-[var(--gm-star)]" />;
      })}
    </span>
  );
}
