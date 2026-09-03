import "server-only";

import { z } from "zod";
import { askJson } from "@/lib/ai/client";
import { catalogFor, familyFor } from "@/constants/maps-attributes";
import type {
  GooglePlace,
  MapsAdvice,
  MapsAttributeAdvice,
  SiteHoursCheck,
} from "@/lib/apify/place-types";
import type { DashboardContext } from "./queries";
import { WRITING_RULES, brief } from "./service";

/**
 * Ce que les modèles écrivent pour la fiche Google Maps : le nom, les deux
 * descriptions, les attributs à cocher, les réponses aux avis, les posts, et
 * les horaires lus sur le site.
 *
 * Une règle traverse ce fichier : rien de ce qui sort d'ici n'est publié
 * automatiquement. L'API Business Profile réclame une validation du compte
 * marchand que nous n'avons pas — le texte est écrit, relu, copié. C'est
 * pourquoi chaque sortie porte de quoi être collée telle quelle, et jamais un
 * conseil du genre « pensez à ajouter un mot-clé ».
 *
 * Deuxième règle : les faits viennent de la fiche, pas du modèle. Un
 * établissement a le droit de ne pas livrer ; lui faire cocher « Livraison »
 * parce que la case existe ferait mentir sa fiche et déclencherait des appels
 * de clients déçus.
 */

// ── Le nom et les deux descriptions ──────────────────────────────────────────

const adviceSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(40).max(320),
  about: z.string().min(120).max(1600),
  reasons: z.array(z.string().min(8).max(300)).max(6),
});

/**
 * Le nom de la fiche, sa description courte et sa présentation, réécrits.
 *
 * Le mot-clé porteur n'est pas choisi ici : c'est celui qui a déjà servi au
 * titre du site, sur la page Contenu. Une fiche et un site qui visent deux
 * expressions différentes se disputent les mêmes résultats, et Google finit par
 * n'en retenir aucun clairement.
 *
 * Le nom mérite un avertissement, et le prompt le porte : Google supprime les
 * fiches dont le nom d'établissement ajoute des mots-clés à l'enseigne réelle.
 * On ne propose donc un nom enrichi que quand le commerce l'emploie déjà —
 * l'enseigne telle qu'elle est peinte sur la devanture, suivie de ce qu'il fait.
 */
export async function writeListingAdvice(
  context: DashboardContext,
  place: GooglePlace,
): Promise<MapsAdvice> {
  const insight = context.analysis?.trendingKeywords ?? null;
  const keywords = insight?.keywords ?? [];
  // Le mot-clé du titre du site : celui de la page Contenu, en tête de liste.
  const keyword = keywords[0]?.keyword ?? null;
  const attributes = auditAttributes(place);

  const written = await askJson(adviceSchema, {
    system:
      "Tu réécris une fiche Google Business Profile pour un commerce local. " +
      "Tu rends des textes prêts à coller dans le back-office Google, jamais des conseils. " +
      "Le nom de l'établissement fait au plus 100 signes, la description courte au plus 300, " +
      "la présentation entre 400 et 750 signes. " +
      "Règle absolue de Google : le nom de la fiche est le nom réel de l'enseigne. " +
      "Tu peux lui ajouter l'activité et la ville quand le commerce les affiche déjà sur sa devanture " +
      "ou son site ; tu n'inventes jamais de mots-clés greffés, sous peine de suspension de la fiche. " +
      WRITING_RULES,
    prompt: [
      brief(context, context.brandVoice),
      "",
      "── La fiche telle qu'elle est aujourd'hui ──",
      `Nom : ${place.title}`,
      `Catégorie : ${place.category ?? "non renseignée"}`,
      `Adresse : ${place.address ?? "non renseignée"}`,
      `Description courte actuelle (écrite par Google) : ${place.description ?? "absente"}`,
      `Présentation actuelle (écrite par le commerce) : ${place.ownerDescription ?? "absente"}`,
      place.rating !== null
        ? `Note : ${place.rating}/5 sur ${place.reviewsCount ?? "?"} avis`
        : "",
      place.reviewsTags.length
        ? `Ce que les clients citent le plus dans les avis : ${place.reviewsTags
            .map((tag) => `${tag.title} (${tag.count} fois)`)
            .join(", ")}`
        : "",
      attributes.length
        ? `Attributs déjà cochés : ${attributes
            .flatMap((group) => group.present)
            .slice(0, 40)
            .join(", ")}`
        : "",
      "",
      "── Les mots-clés de la niche, relevés ce mois-ci ──",
      keyword ? `Mot-clé porteur, déjà employé dans le titre du site : ${keyword}` : "",
      keywords.length
        ? `Autres mots-clés : ${keywords
            .slice(1, 8)
            .map((k) => k.keyword)
            .join(", ")}`
        : "",
      context.analysis?.trendingKeywords?.suggested.title
        ? `Titre du site déjà proposé, dont la fiche doit reprendre le mot-clé : ${context.analysis.trendingKeywords.suggested.title}`
        : "",
      "",
      "Écris :",
      "- title : le nom de l'établissement. Pars du nom actuel. Ne le rallonge que si le commerce",
      "  affiche déjà cette activité ou cette ville dans son enseigne ou sur son site. Si le nom actuel",
      "  est déjà conforme et porteur, rends-le à l'identique : c'est une réponse valable.",
      "- description : la description courte, 200 à 300 signes. Ce que fait le commerce, où, et le fait",
      "  qui le distingue selon ses propres avis. Le mot-clé porteur en toutes lettres, une seule fois.",
      "- about : la présentation de l'onglet « À propos », 400 à 750 signes, deux ou trois paragraphes",
      "  séparés par une ligne vide. Le premier répond à « qui, quoi, où » et doit pouvoir être cité",
      "  seul par un assistant. Les suivants ajoutent des faits vérifiables tirés du brief et des avis :",
      "  ce qu'on y mange ou ce qu'on y trouve, comment on réserve, ce qui distingue l'endroit.",
      "- reasons : trois phrases, une par texte, disant ce que la réécriture change pour la visibilité.",
      "",
      "Aucun fait inventé : ni prix, ni distinction, ni année d'ouverture qui ne soient dans le brief.",
      'Réponds en JSON : { "title", "description", "about", "reasons": [] }',
    ]
      .filter(Boolean)
      .join("\n"),
    role: "mapsListing",
    maxTokens: 1600,
  });

  return {
    keyword,
    title: written.title,
    description: written.description,
    about: written.about,
    reasons: written.reasons,
    attributes,
    generatedAt: new Date().toISOString(),
  };
}

// ── Les attributs ────────────────────────────────────────────────────────────

const attributesSchema = z.object({
  groups: z
    .array(
      z.object({
        group: z.string().min(2).max(60),
        suggested: z
          .array(
            z.object({
              label: z.string().min(2).max(80),
              why: z.string().min(5).max(200),
            }),
          )
          .max(12),
        skipped: z.array(z.string().min(2).max(80)).max(20),
      }),
    )
    .max(20),
});

/**
 * Compare la fiche au catalogue Google : ce qui est coché, ce qui manque.
 *
 * Étape déterministe, sans modèle : le catalogue est une liste fermée, la fiche
 * en porte une partie, et la différence se calcule. Le modèle intervient
 * ensuite, dans `adviseAttributes`, pour trancher entre « manquant à cocher » et
 * « sans rapport avec ce commerce ».
 *
 * Tant qu'il n'a pas tranché, tout ce qui manque part dans `suggested` sans
 * justification : c'est déjà utile, et c'est ce qui s'affiche quand aucune
 * proposition n'a encore été demandée.
 */
export function auditAttributes(place: GooglePlace): MapsAttributeAdvice[] {
  const catalog = catalogFor(familyFor(place.category));
  const checked = new Map<string, Set<string>>();

  for (const group of place.attributes) {
    checked.set(
      group.label,
      new Set(group.items.filter((item) => item.available).map((item) => item.label)),
    );
  }

  return catalog.map((entry) => {
    const present = checked.get(entry.group) ?? new Set<string>();
    return {
      group: entry.group,
      present: entry.items.filter((item) => present.has(item)),
      suggested: entry.items
        .filter((item) => !present.has(item))
        .map((label) => ({ label, why: "" })),
      skipped: [],
    };
  });
}

/**
 * Trie les attributs manquants : ceux à cocher, ceux à laisser.
 *
 * Le modèle ne décide pas seul de ce que fait le commerce : il lit les avis, la
 * présentation et le brief, et n'avance un attribut que si quelque chose l'y
 * autorise. Un restaurant dont trente avis parlent de la terrasse a une
 * terrasse ; celui dont personne ne mentionne la livraison ne livre
 * probablement pas, et la case reste vide.
 */
export async function adviseAttributes(
  context: DashboardContext,
  place: GooglePlace,
  audit: MapsAttributeAdvice[],
): Promise<MapsAttributeAdvice[]> {
  const missing = audit.filter((group) => group.suggested.length > 0);
  if (missing.length === 0) return audit;

  const result = await askJson(attributesSchema, {
    system:
      "Tu tries les attributs manquants d'une fiche Google Business Profile. " +
      "Pour chaque attribut absent, tu décides s'il correspond vraiment à ce commerce. " +
      "Tu ne coches un attribut que si le brief, la présentation ou les avis l'attestent : " +
      "une fiche qui annonce un service inexistant fait venir des clients déçus, et Google la sanctionne. " +
      "Dans le doute, tu écartes.",
    prompt: [
      brief(context),
      "",
      `Commerce : ${place.title} — ${place.category ?? "catégorie inconnue"}`,
      place.ownerDescription ? `Présentation : ${place.ownerDescription}` : "",
      place.description ? `Description Google : ${place.description}` : "",
      place.reviewsTags.length
        ? `Mots des avis : ${place.reviewsTags.map((tag) => tag.title).join(", ")}`
        : "",
      place.reviews.length
        ? `Extraits d'avis : ${place.reviews
            .map((review) => review.text)
            .filter(Boolean)
            .slice(0, 5)
            .join(" | ")
            .slice(0, 1500)}`
        : "",
      `Attributs déjà cochés : ${audit.flatMap((group) => group.present).join(", ") || "aucun"}`,
      "",
      "── Attributs absents, groupe par groupe ──",
      ...missing.map(
        (group) => `${group.group} : ${group.suggested.map((item) => item.label).join(", ")}`,
      ),
      "",
      "Pour chaque groupe, répartis les attributs absents entre :",
      "- suggested : à cocher, avec « why » = la raison en une phrase, tirée d'un fait ci-dessus.",
      "- skipped : sans rapport avec ce commerce, ou invérifiable.",
      "Chaque attribut absent apparaît dans l'une des deux listes, jamais dans les deux.",
      'Réponds en JSON : { "groups": [{ "group", "suggested": [{ "label", "why" }], "skipped": [] }] }',
    ]
      .filter(Boolean)
      .join("\n"),
    role: "default",
    maxTokens: 2400,
  });

  const byGroup = new Map(result.groups.map((group) => [group.group, group]));

  return audit.map((group) => {
    const verdict = byGroup.get(group.group);
    if (!verdict) return group;

    // On ne garde que les libellés du catalogue : un modèle qui inventerait un
    // attribut enverrait le client chercher une case qui n'existe pas.
    const known = new Set(group.suggested.map((item) => item.label));
    const suggested = verdict.suggested
      .filter((item) => known.has(item.label))
      .map((item) => ({ label: item.label, why: item.why }));
    const kept = new Set(suggested.map((item) => item.label));

    return {
      ...group,
      suggested,
      skipped: [...known].filter((label) => !kept.has(label)),
    };
  });
}

// ── Les réponses aux avis ────────────────────────────────────────────────────

const repliesSchema = z.object({
  replies: z
    .array(
      z.object({
        reviewId: z.string().min(1).max(200),
        reply: z.string().min(20).max(900),
      }),
    )
    .max(12),
});

/**
 * Une réponse par avis, dans le ton relevé sur le site du client.
 *
 * Le ton ne vient pas du modèle : il vient de l'analyse, où il a été constaté
 * sur les propres textes du commerce, puis corrigé par la voix de marque si le
 * client en a réglé une. Une réponse qui sonne comme un service client
 * standardisé se repère à la première ligne, et elle reste publique.
 *
 * Les avis à une ou deux étoiles reçoivent une consigne à part : Google et les
 * lecteurs jugent la réponse plus que l'avis, et une réponse qui conteste fait
 * plus de mal que l'avis lui-même.
 */
export async function draftReviewReplies(
  context: DashboardContext,
  place: GooglePlace,
  /** Les avis à traiter : ceux qui n'ont pas encore de réponse du propriétaire. */
  reviews: GooglePlace["reviews"],
): Promise<{ reviewId: string; reply: string }[]> {
  if (reviews.length === 0) return [];

  const signature = context.businessName || place.title;

  const result = await askJson(repliesSchema, {
    system:
      "Tu écris les réponses publiques d'un commerçant aux avis Google de son établissement. " +
      "Chaque réponse est signée du commerce et reste visible sous l'avis pour des années. " +
      "Une réponse fait deux à quatre phrases, remercie sans flagornerie, reprend un détail précis " +
      "de l'avis pour montrer qu'il a été lu, et ne recopie jamais la même formule d'un avis à l'autre. " +
      "Sur un avis négatif : tu reconnais le fait, tu dis ce qui est fait pour y remédier, tu proposes " +
      "de poursuivre en privé. Jamais de contestation, jamais d'explication qui rejette la faute sur le client. " +
      WRITING_RULES,
    prompt: [
      brief(context, context.brandVoice),
      "",
      `Nom à employer pour signer : ${signature}`,
      "",
      "── Les avis auxquels répondre ──",
      ...reviews.map((review) =>
        [
          `[${review.id}] ${review.stars}/5 — ${review.name}`,
          review.text ? `« ${review.text.slice(0, 900)} »` : "(avis sans texte, une note seule)",
          review.context.length
            ? `Contexte : ${review.context.map((entry) => `${entry.label} : ${entry.value}`).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      "",
      "Écris une réponse par avis, dans la langue de l'avis.",
      "Un avis sans texte reçoit un remerciement court, deux phrases au plus, sans inventer ce qui a plu.",
      "Reprends l'identifiant entre crochets tel quel dans « reviewId ».",
      'Réponds en JSON : { "replies": [{ "reviewId", "reply" }] }',
    ]
      .filter(Boolean)
      .join("\n"),
    role: "reviewReply",
    maxTokens: 2600,
  });

  const known = new Set(reviews.map((review) => review.id));
  return result.replies.filter((reply) => known.has(reply.reviewId));
}

// ── Les horaires du site ─────────────────────────────────────────────────────

const hoursSchema = z.object({
  found: z.boolean(),
  location: z.string().max(120).nullable(),
  days: z
    .array(z.object({ day: z.string().min(3).max(20), hours: z.string().min(1).max(80) }))
    .max(7),
});

/**
 * Les horaires affichés sur la page d'accueil du site, et leur écart avec la
 * fiche.
 *
 * Google croise les deux sources. Quand elles se contredisent, il n'en croit
 * plus aucune franchement, et c'est l'incohérence locale la plus répandue : le
 * site garde les horaires d'été trois ans pendant que la fiche est tenue à jour.
 *
 * L'extraction relit le crawl déjà en base plutôt que de recharger le site. Les
 * horaires y sont écrits en toutes lettres, souvent dans un pied de page, dans
 * une mise en forme différente à chaque site : c'est de la lecture, pas du
 * jugement, et un modèle rapide suffit.
 */
export async function readSiteHours(
  homepageText: string,
  listing: GooglePlace | null,
): Promise<SiteHoursCheck> {
  const read = await askJson(hoursSchema, {
    system:
      "Tu extrais les horaires d'ouverture affichés sur la page d'accueil d'un site de commerce. " +
      "Tu ne rends que ce qui est écrit sur la page : jamais d'horaire deviné, jamais complété. " +
      "Les jours sont en français et en minuscules ; les horaires gardent l'écriture du site.",
    prompt: [
      "── Contenu de la page d'accueil ──",
      homepageText.slice(0, 12_000),
      "",
      "Trouve les horaires d'ouverture. Ils sont souvent dans le pied de page, un bloc « contact »,",
      "« nous trouver » ou « informations pratiques ».",
      "- found : true seulement si la page affiche vraiment des horaires.",
      "- location : où ils se trouvent, en trois mots (« pied de page », « bloc contact »).",
      "- days : un objet par jour mentionné. Une plage « du lundi au vendredi » se déplie en cinq jours.",
      "  Un jour de fermeture porte « Fermé ».",
      'Réponds en JSON : { "found", "location", "days": [{ "day", "hours" }] }',
    ].join("\n"),
    role: "extract",
    maxTokens: 900,
  });

  const days = read.found ? read.days.map((entry) => ({ ...entry, day: entry.day.toLowerCase() })) : [];
  const conflicts = listing ? compareHours(days, listing) : [];

  return {
    found: read.found,
    location: read.location,
    days,
    conflicts,
    summary: summarizeHours(read.found, days.length, conflicts.length, listing !== null),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Les jours où le site et la fiche ne disent pas la même chose.
 *
 * La comparaison porte sur les chiffres, pas sur les mots : « 10h30 - 15h » et
 * « 10:30–15:00 » sont le même horaire écrit deux fois, et signaler cet
 * écart-là ferait perdre au client la confiance dans les vrais.
 */
function compareHours(
  siteDays: { day: string; hours: string }[],
  listing: GooglePlace,
): SiteHoursCheck["conflicts"] {
  const byDay = new Map(listing.openingHours.map((row) => [row.day, row.hours]));

  return siteDays
    .map((entry) => {
      const listed = byDay.get(entry.day);
      if (!listed) return null;
      if (digitsOf(entry.hours) === digitsOf(listed)) return null;
      // Les deux disent « fermé », dans deux formulations : ce n'est pas un écart.
      if (isClosed(entry.hours) && isClosed(listed)) return null;
      return { day: entry.day, site: entry.hours, listing: listed };
    })
    .filter((row): row is SiteHoursCheck["conflicts"][number] => row !== null);
}

/** Les chiffres d'un horaire, séparateurs et mots retirés : « 10301500 ». */
function digitsOf(hours: string): string {
  return hours.replace(/[^\d]/g, "");
}

function isClosed(hours: string): boolean {
  return /ferm|closed/i.test(hours);
}

function summarizeHours(
  found: boolean,
  dayCount: number,
  conflictCount: number,
  hasListing: boolean,
): string {
  if (!found) {
    return "La page d'accueil n'affiche aucun horaire. Google ne peut pas recouper votre fiche avec votre site.";
  }
  if (!hasListing) {
    return `${dayCount} jours d'horaires lus sur la page d'accueil. Relevez votre fiche Google Maps pour les comparer.`;
  }
  if (conflictCount === 0) {
    return "Les horaires du site et ceux de la fiche disent la même chose.";
  }
  return conflictCount === 1
    ? "Un jour où le site et la fiche se contredisent. Google ne sait plus lequel croire."
    : `${conflictCount} jours où le site et la fiche se contredisent. Google ne sait plus lequel croire.`;
}
