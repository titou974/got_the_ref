/**
 * Rendu d'un bloc JSON-LD. `<` échappé pour empêcher toute évasion hors du
 * `<script>` si une donnée interpolée venait un jour à contenir des balises.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
