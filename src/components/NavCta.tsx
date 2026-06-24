"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants/routes";

/**
 * CTA principal de la navbar : ramène vers la home (où vit le champ d'analyse).
 * Masqué sur la home elle-même, puisqu'on y est déjà.
 */
export function NavCta({ label, className = "" }: { label: string; className?: string }) {
  const pathname = usePathname();
  if (pathname === ROUTES.home) return null;

  return (
    <Link
      href={ROUTES.home}
      className={`cursor-pointer rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${className}`}
    >
      {label}
    </Link>
  );
}
