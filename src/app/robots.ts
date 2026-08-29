import type { MetadataRoute } from "next";

/**
 * `robots.txt` du site.
 *
 * Les pages vitrine sont ouvertes — c'est tout l'objet du produit. En revanche
 * les rapports d'analyse, l'espace compte et le retour de paiement portent des
 * données de client : un rapport payé n'est protégé que par son lien, l'indexer
 * en ferait une page publique. Les routes d'API n'ont rien à faire dans un index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/analyse/", "/compte", "/paiement/", "/api/"],
    },
  };
}
