import { getTranslations } from "next-intl/server";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

export async function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("legal");
  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />
      <article className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{t("lastUpdated", { date: updated })}</p>
        <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-muted">
          {children}
        </div>
      </article>
      <Footer />
      <style>{`
        .legal h2 { color: var(--color-text); font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .legal h3 { color: var(--color-text); font-size: 1.05rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem; }
        .legal p { margin-bottom: 0.5rem; }
        .legal ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .legal li { margin-bottom: 0.25rem; }
        .legal a { color: var(--color-text); text-decoration: underline; text-underline-offset: 3px; }
        .legal strong { color: var(--color-text); }
      `}</style>
    </main>
  );
}
