"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { RiCalendarCheckLine, RiCloseLine, RiComputerLine } from "@remixicon/react";
import { refreshRankingsAction } from "@/features/dashboard/actions";
import { tierAtLeast, type AccessTier } from "@/constants/access";

/**
 * Les deux mots posés en haut du tableau de bord, sur téléphone seulement.
 *
 * Sur un grand écran, ils n'ont rien à dire : les classements y sont déjà côte
 * à côte, et le bouton de relevé est visible sans faire défiler. Sur téléphone,
 * les deux manquent, et c'est là qu'un mot vaut la place qu'il prend.
 *
 * Le premier rappelle le geste qui fait vivre le produit : relever sa position
 * tous les jours. Il revient chaque jour, et c'est voulu — un rappel quotidien
 * rangé après un seul refus ne rappelle plus rien. Une fois traité, il se tait
 * jusqu'au lendemain.
 *
 * Le second ne s'adresse qu'aux comptes gratuits, ceux qui découvrent l'écran :
 * il dit où le produit se lit le mieux et laisse repartir en un lien. Refusé
 * une fois, il ne revient pas — ce n'est pas un rappel, c'est un conseil.
 */
const DAILY_KEY = "gotref:notice:daily";
const DESKTOP_KEY = "gotref:notice:desktop:v1";

/** Le temps que la page se pose avant que les mots ne montent. */
const APPEAR_MS = 320;

/** La journée en cours, en clé de stockage : « 2026-08-31 ». */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Un navigateur qui refuse le stockage (navigation privée verrouillée) ne
    // doit pas priver le client du message : on affiche, sans mémoire.
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Sans mémoire, le mot reviendra au prochain chargement. Tant pis. */
  }
}

export function DashboardNotices({ tier }: { tier: AccessTier }) {
  // Le premier rendu ne montre rien : ce que le navigateur a retenu ne se lit
  // qu'après hydratation, et deviner ici donnerait deux balisages différents.
  const [mounted, setMounted] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showDesktop, setShowDesktop] = useState(false);

  const free = !tierAtLeast(tier, "boost");

  useEffect(() => {
    // Le mot se pose une fois la page arrivée, plutôt que de sauter au premier
    // rendu : sur téléphone, un bloc qui apparaît sous le doigt pendant qu'on
    // commence à faire défiler déplace tout ce qu'on lisait.
    const timer = setTimeout(() => {
      setShowDaily(read(DAILY_KEY) !== today());
      setShowDesktop(read(DESKTOP_KEY) !== "1");
      setMounted(true);
    }, APPEAR_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;
  if (!showDaily && !(free && showDesktop)) return null;

  return (
    <div className="space-y-3 lg:hidden">
      {showDaily && (
        <DailyNotice
          onDismiss={() => {
            write(DAILY_KEY, today());
            setShowDaily(false);
          }}
        />
      )}

      {free && showDesktop && (
        <DesktopNotice
          onDismiss={() => {
            write(DESKTOP_KEY, "1");
            setShowDesktop(false);
          }}
        />
      )}
    </div>
  );
}

/** Relancer le relevé, depuis le haut de l'écran. */
function DailyNotice({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("dashboard.notices");
  const router = useRouter();

  const { execute, isPending } = useAction(refreshRankingsAction, {
    onSuccess: () => {
      onDismiss();
      router.refresh();
    },
  });

  return (
    <NoticeCard
      icon={<RiCalendarCheckLine className="size-4" aria-hidden />}
      title={t("dailyTitle")}
      body={t("dailyBody")}
      onDismiss={onDismiss}
      action={
        <button
          type="button"
          disabled={isPending}
          onClick={() => execute({})}
          className="inline-flex cursor-pointer items-center justify-center rounded-pill bg-cta px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-ash disabled:shadow-none"
        >
          {isPending ? t("dailyPending") : t("dailyCta")}
        </button>
      }
      secondary={
        isPending ? null : (
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer text-sm font-medium text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text"
          >
            {t("dailyLater")}
          </button>
        )
      }
    />
  );
}

/** Le conseil d'ouvrir l'écran sur un grand écran, et le lien pour y aller. */
function DesktopNotice({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("dashboard.notices");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <NoticeCard
      icon={<RiComputerLine className="size-4" aria-hidden />}
      title={t("desktopTitle")}
      body={t("desktopBody")}
      onDismiss={onDismiss}
      action={
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              // Le presse-papier est refusé hors HTTPS et sur certains
              // navigateurs mobiles : sans copie, on ne prétend pas l'avoir
              // faite. L'adresse reste dans la barre du navigateur.
              setCopied(false);
            }
          }}
          className="inline-flex cursor-pointer items-center justify-center rounded-pill bg-cta px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
        >
          {copied ? t("desktopCopied") : t("desktopCta")}
        </button>
      }
      secondary={
        <button
          type="button"
          onClick={onDismiss}
          className="cursor-pointer text-sm font-medium text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text"
        >
          {t("desktopDismiss")}
        </button>
      }
    />
  );
}

/**
 * Le cadre commun aux deux mots : pastille, titre, phrase, et les deux sorties.
 *
 * La carte est sourde plutôt que blanche. Le tableau de bord est fait de cartes
 * blanches sur toile grise : un mot posé dessus doit se distinguer d'une carte
 * de donnée au premier regard, sinon on le lit comme une mesure de plus.
 */
function NoticeCard({
  icon,
  title,
  body,
  action,
  secondary,
  onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
  secondary: React.ReactNode;
  onDismiss: () => void;
}) {
  const t = useTranslations("dashboard.notices");

  return (
    <section className="relative rounded-[28px] border border-border bg-fog p-5">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("close")}
        className="absolute right-3 top-3 cursor-pointer rounded-full p-2 text-ash transition-colors duration-200 hover:bg-snow hover:text-text"
      >
        <RiCloseLine className="size-5 shrink-0" aria-hidden />
      </button>

      <div className="flex items-start gap-4">
        {/* Deux disques emboîtés : l'anneau clair détache la pastille noire de
            la carte sourde, qui sinon l'avalerait. */}
        <span
          aria-hidden
          className="inline-flex shrink-0 rounded-full bg-obsidian/10 p-1.5 text-obsidian"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-obsidian text-white">
            {icon}
          </span>
        </span>

        <div className="min-w-0 pr-6">
          <h2 className="text-base font-semibold leading-snug">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            {action}
            {secondary}
          </div>
        </div>
      </div>
    </section>
  );
}
