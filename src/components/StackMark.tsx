import { platformById } from "@/constants/platforms";
import type { DetectedStack } from "@/lib/geo/types";

/**
 * Logo monochrome d'une plateforme. Pas d'état, pas de hook : utilisable côté
 * serveur comme côté client.
 */
export function StackMark({
  id,
  size = 16,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const meta = platformById(id);
  if (!meta) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path d={meta.path} fillRule={meta.evenOdd ? "evenodd" : undefined} />
    </svg>
  );
}

/**
 * Pastille « plateforme détectée » : logo + nom. Le doute est porté par le
 * libellé (« probable »), jamais masqué — une détection incertaine reste une
 * information utile tant qu'elle est annoncée comme telle.
 */
export function StackBadge({
  stack,
  className = "",
  probableLabel,
}: {
  stack: DetectedStack;
  className?: string;
  /** Mention affichée quand la reconnaissance n'est pas certaine. */
  probableLabel?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-fog bg-snow px-2.5 py-1 text-xs font-medium text-text ${className}`}
    >
      <StackMark id={stack.id} size={14} className="text-steel" />
      {stack.name}
      {stack.confidence === "probable" && probableLabel && (
        <span className="text-[10px] font-normal text-steel">{probableLabel}</span>
      )}
    </span>
  );
}
