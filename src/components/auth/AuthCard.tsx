import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ROUTES } from "@/constants/routes";

/**
 * La carte blanche centrée des écrans de mot de passe.
 *
 * Volontairement plus dépouillée que `AuthScreen` : ni bandeau animé, ni
 * repères chiffrés. Qui arrive ici n'a rien à décider — il a un mot de passe à
 * retrouver, et tout ce qui l'entoure le retarde.
 */
export function AuthCard({
  title,
  subtitle,
  backLabel,
  children,
}: {
  title: string;
  subtitle: string;
  /** Libellé du retour à l'accueil, sous la carte. */
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-5 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-8">
        <h1 className="text-center text-2xl font-bold">{title}</h1>
        <p className="mt-1 mb-6 text-center text-sm text-muted">{subtitle}</p>
        {children}
      </div>
      <Link
        href={ROUTES.home}
        className="mt-6 cursor-pointer text-sm text-muted hover:text-text"
      >
        {backLabel}
      </Link>
    </main>
  );
}
