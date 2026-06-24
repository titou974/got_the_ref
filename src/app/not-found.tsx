import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <Logo className="mb-8" />
      <p className="font-display text-6xl font-bold text-gradient">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-muted">
        Cette page n'existe pas ou l'analyse demandée a expiré.
      </p>
      <Link
        href="/"
        className="mt-6 cursor-pointer rounded-full bg-cta px-5 py-2.5 font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
      >
        Retour à l'accueil
      </Link>
    </main>
  );
}
