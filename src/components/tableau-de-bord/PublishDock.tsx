import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RiArrowRightUpLine } from "@remixicon/react";
import { ROUTES } from "@/constants/routes";
import { Card } from "./Card";
import { SiteFavicon } from "./SiteFavicon";

/**
 * Le quai de départ : ce qui part, et ce qu'on attend de vous.
 *
 * La page Articles posait sept cartes — départ, planning, quota, agenda,
 * publiés, voix de marque, calendrier — et le client devait deviner par où
 * commencer. Elle en pose deux : ce bandeau, puis le calendrier. Le bandeau ne
 * dit que deux choses, celles qui répondent aux deux seules questions qu'on se
 * pose en ouvrant la page. Qu'est-ce qui part ensuite ? Et qu'est-ce qu'on
 * attend de moi ?
 *
 * Il ne porte donc plus aucun bouton. Publier, valider, écarter sont des
 * décisions qui se prennent article en main : elles ont quitté cet écran pour
 * la barre d'action de l'atelier, où l'on a le texte sous les yeux. Ce qui
 * reste ici est de la lecture — et deux portes vers l'article dont on parle.
 *
 * Le liseré vertical à gauche est la signature de l'état « à quai ». On le
 * retrouve, en deux pixels, sur chaque vignette validée du calendrier, et en
 * tête des fenêtres de confirmation : même signal, trois échelles, aucune
 * couleur nouvelle à apprendre.
 */

export type DockArticle = {
  id: string;
  title: string;
  /** « mardi 8 septembre », composée côté serveur dans le fuseau du client. */
  dateLabel: string;
  /** « 09:00 ». Le moment du départ réel, pas celui de la consigne. */
  timeLabel: string;
  /**
   * Jours de calendrier d'ici au départ. Négatif quand la date est passée : la
   * file rattrape alors son retard au prochain passage, et l'écran le dit.
   */
  days: number;
};

export function PublishDock({
  next,
  toApprove,
  firstToApprove,
  blocked,
  linked,
  canPublish,
  domain,
}: {
  next: DockArticle | null;
  /** Articles rédigés qui attendent la validation du client. */
  toApprove: number;
  /** Le premier de la pile : le compteur ouvre son atelier. */
  firstToApprove: string | null;
  /** Validés et rédigés qu'aucun rattachement ne peut déposer. */
  blocked: number;
  /** Un site est rattaché — sans préjuger de ce qu'il laisse faire. */
  linked: boolean;
  canPublish: boolean;
  /** Le domaine suivi, nommé et montré tant que la porte manque. */
  domain: string | null;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col sm:flex-row">
        {/* ---------------------- Ce qui part ensuite --------------------- */}
        <div className="flex min-w-0 flex-1">
          {/* Le liseré. Plein quand un départ est armé, sourd quand le quai est
              vide : la carte dit son état avant même d'être lue. */}
          <span
            aria-hidden
            className={`w-1 shrink-0 ${next && canPublish ? "bg-obsidian" : "bg-fog"}`}
          />

          <div className="min-w-0 flex-1">
            {!canPublish ? (
              <NoDoor linked={linked} blocked={blocked} domain={domain} />
            ) : !next ? (
              <Empty />
            ) : (
              <Departure next={next} />
            )}
          </div>
        </div>

        {/* ----------------------- Ce qu'on attend ------------------------ */}
        <Review count={toApprove} firstId={firstToApprove} />
      </div>
    </Card>
  );
}

/**
 * Le prochain départ, en trois lignes et un lien.
 *
 * Le titre porte la plus grande taille, pas l'heure : c'est par son nom qu'on
 * reconnaît son article, et l'heure ne devient intéressante qu'une fois qu'on
 * sait de quoi elle est l'heure. La ligne de date est en chiffres tabulaires —
 * c'est une donnée, pas une légende.
 *
 * Toute la zone est cliquable : sur cet écran, « le prochain départ » et
 * « l'article » sont la même chose, et un lien discret à côté d'un titre
 * cliquable aurait été un second chemin vers la même porte.
 */
async function Departure({ next }: { next: DockArticle }) {
  const t = await getTranslations("dashboard.dock");

  return (
    <Link
      href={ROUTES.dashboardArticle(next.id)}
      className="block h-full cursor-pointer p-5 transition-colors duration-200 hover:bg-mist/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-obsidian/40 sm:p-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
        {t("eyebrow")}
      </p>

      {/* Pas de flèche à côté du titre : la zone entière est un lien, elle
          s'éclaircit au survol, et une flèche de plus aurait fait deux signaux
          pour une seule porte. Le compteur d'à côté garde la sienne — lui a un
          libellé à porter. */}
      <p className="mt-3 text-lg font-semibold leading-snug text-text sm:text-xl">{next.title}</p>

      <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-sm font-medium text-text">{next.dateLabel}</span>
        <span className="text-base font-semibold tabular-nums text-text">{next.timeLabel}</span>
        <span className={`text-sm ${next.days < 0 ? "font-medium text-warning" : "text-muted"}`}>
          {next.days < 0 ? t("late") : t("inDays", { count: next.days })}
        </span>
      </p>
    </Link>
  );
}

/**
 * Le compteur de relecture.
 *
 * Un seul grand chiffre sur toute la page : le calendrier en dessous porte les
 * titres et les dates, ce bloc porte la seule quantité qui appelle un geste. Il
 * est cliquable et mène au premier article de la pile — un compteur qui n'ouvre
 * rien laisse le client chercher lui-même dans la grille ce qu'il doit relire.
 *
 * À zéro, il ne disparaît pas : sa place vide est l'information. Le client sait
 * alors qu'il n'a rien laissé traîner, ce qu'un bloc absent ne dit pas.
 */
async function Review({ count, firstId }: { count: number; firstId: string | null }) {
  const t = await getTranslations("dashboard.dock");

  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
        {t("reviewTitle")}
      </p>
      <p
        className={`mt-2 text-[40px] font-semibold leading-none tabular-nums ${
          count > 0 ? "text-obsidian" : "text-pebble"
        }`}
      >
        {count}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-muted">
        {count > 0 ? t("reviewBody", { count }) : t("reviewEmpty")}
      </p>
    </>
  );

  const shell =
    "flex w-full shrink-0 flex-col justify-center border-t border-border bg-mist p-5 sm:w-[13.5rem] sm:border-t-0 sm:border-l sm:p-6";

  if (count === 0 || !firstId) {
    return <div className={shell}>{inner}</div>;
  }

  return (
    <Link
      href={ROUTES.dashboardArticle(firstId)}
      className={`${shell} cursor-pointer transition-colors duration-200 hover:bg-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-obsidian/40`}
    >
      {inner}
      <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-text underline decoration-pebble underline-offset-4">
        {t("reviewOpen")}
        <RiArrowRightUpLine aria-hidden className="size-3.5" />
      </span>
    </Link>
  );
}

/**
 * Rien ne peut partir : il manque la porte, pas les articles.
 *
 * Deux situations, et il ne faut surtout pas les confondre. Sans site rattaché,
 * il y a un geste à faire et un bouton pour le faire. Avec un site rattaché qui
 * n'ouvre pas sa rédaction — une boutique Wix sans blog, un PrestaShop dont la
 * clé n'a pas les pages de contenu — il n'y a rien à brancher de plus : le
 * dépôt se fait à la main, article par article, et envoyer le client aux
 * réglages l'y ferait tourner en rond.
 */
async function NoDoor({
  linked,
  blocked,
  domain,
}: {
  linked: boolean;
  blocked: number;
  domain: string | null;
}) {
  const t = await getTranslations("dashboard.dock");

  return (
    <div className="p-5 sm:p-6">
      {/* Pas de surtitre ici. « Prochaine publication » annonçait un départ
          au-dessus d'une carte qui explique justement que rien ne peut partir :
          sans porte, il n'y a pas de prochaine publication à annoncer. Le nom du
          site ouvre donc directement. */}

      {/* Le site, nommé et reconnaissable, avant qu'on parle de le rattacher.
          La carte annonçait « aucun site » à un client qui en a un, qu'on
          mesure depuis son inscription et dont on connaît l'adresse : ce qui
          manque, c'est la clé de dépôt, pas le site. Son icône le dit plus vite
          que la phrase — c'est celle de son onglet de navigateur. */}
      {domain ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-pill border border-border bg-mist px-3 py-1.5">
          <SiteFavicon domain={domain} className="size-4" />
          <span className="truncate text-[13px] font-medium text-text">{domain}</span>
        </span>
      ) : null}

      <p className={`text-base font-medium text-text ${domain ? "mt-2.5" : ""}`}>
        {linked ? t("manualTitle") : t("unconnectedTitle")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {linked
          ? t("manualBody")
          : blocked > 0
            ? t("unconnectedWaiting", { count: blocked })
            : t("unconnectedBody")}
      </p>

      {linked ? null : (
        <Link
          href={ROUTES.dashboardSettings}
          className="mt-4 inline-flex cursor-pointer items-center rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
        >
          {domain ? t("connectDomain", { domain }) : t("connect")}
        </Link>
      )}
    </div>
  );
}

/** Le lien est bon, le quai est vide : il manque une validation. */
async function Empty() {
  const t = await getTranslations("dashboard.dock");

  return (
    <div className="p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
        {t("eyebrow")}
      </p>
      <p className="mt-3 text-base font-medium text-text">{t("emptyTitle")}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t("emptyBody")}</p>
    </div>
  );
}
