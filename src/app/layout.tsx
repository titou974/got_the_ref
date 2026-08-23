import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";
import { BOOST, SUBSCRIPTION_PRICE } from "@/constants/plans";
import { JsonLd } from "@/lib/seo/json-ld";
import "./globals.css";

// Cosmica (typo unique Awesomic) — substitut : Plus Jakarta Sans, graisses 300–700.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: t("title"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
    alternates: { canonical: "/" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
      locale: SITE.locale,
      siteName: SITE.name,
      url: SITE.url,
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
    },
  };
}

/**
 * Organization + WebSite : identité d'entité pour les IA (E-E-A-T) et les
 * moteurs classiques. Le fondateur est nommé en `founder` — signal
 * d'authenticité qu'un site anonyme n'a pas.
 */
function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/visia-512.png`,
    description: SITE.tagline,
    email: SITE.contactEmail,
    foundingDate: String(SITE.foundedYear),
    founder: {
      "@type": "Person",
      name: SITE.founder.name,
      url: SITE.founder.url,
    },
    sameAs: [SITE.founder.url],
  };
}

function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.tagline,
    publisher: { "@id": `${SITE.url}/#organization` },
    inLanguage: SITE.lang,
  };
}

/**
 * SoftwareApplication : marque explicitement got_the_ref comme logiciel
 * plutôt qu'agence pour les moteurs qui lisent ce type structuré.
 */
function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}/#software`,
    name: SITE.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Logiciel qui pilote automatiquement la visibilité d'un commerce sur ChatGPT, Gemini et Google. Il suffit d'indiquer l'adresse du site et, pour un commerce physique, sa fiche Google Maps : des agents IA mesurent, corrigent et republient, sans compétence technique requise.",
    offers: [
      {
        "@type": "Offer",
        name: "Abonnement mensuel",
        price: SUBSCRIPTION_PRICE,
        priceCurrency: "EUR",
        url: `${SITE.url}${ROUTES.pricing}`,
      },
      {
        "@type": "Offer",
        name: "Coup de Boost",
        price: BOOST.price,
        priceCurrency: "EUR",
        url: `${SITE.url}${ROUTES.pricing}`,
      },
    ],
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${jakarta.variable} h-full`}>
      <body className="min-h-full">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <JsonLd data={softwareApplicationJsonLd()} />
        <div className="bg-ambient" aria-hidden />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        {/* Visiteurs et pages vues Vercel — inerte hors production. */}
        <Analytics />
      </body>
    </html>
  );
}
