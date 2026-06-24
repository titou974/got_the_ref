"use client"; // Les error boundaries doivent être des Client Components.

import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    // global-error doit définir ses propres balises <html> et <body>.
    <html lang="fr">
      <title>Une erreur est survenue · GEOBoost</title>
      <body className="min-h-full">
        <div className="bg-ambient" aria-hidden />
        <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
          <p className="font-display text-6xl font-bold text-gradient">Oups</p>
          <h1 className="mt-4 text-2xl font-bold">Une erreur est survenue</h1>
          <p className="mt-2 max-w-sm text-muted">
            Un problème inattendu a interrompu le chargement. Vous pouvez réessayer.
          </p>
          {error.digest ? (
            <p className="mt-2 text-xs text-muted/70">Référence : {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-6 cursor-pointer rounded-full bg-cta px-5 py-2.5 font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
