import type { MetadataRoute } from "next";
import { SITE } from "@/constants/site";
import { ROUTES } from "@/constants/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE.url}${path}`;
  const now = new Date();

  return [
    { url: url(ROUTES.home), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: url(ROUTES.pricing), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: url(ROUTES.demo), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: url(ROUTES.contact), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url(ROUTES.legal.mentions), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: url(ROUTES.legal.terms), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: url(ROUTES.legal.privacy), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
