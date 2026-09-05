"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  draftProspectMessageAction,
  findProspectsAction,
  setProspectStatusAction,
} from "@/features/dashboard/actions";
import { Card, PageHeader } from "./Card";
import { SearchLoader } from "@/components/SearchLoader";

/**
 * Les sites de la niche à démarcher, un seul à l'écran.
 *
 * Une liste de quatorze sites à déplier ligne par ligne demande au client de
 * décider quatorze fois par où commencer ; il ne commence nulle part. L'écran
 * n'en montre donc qu'un, dans l'ordre de l'autorité, avec les trois gestes du
 * contact posés dans l'ordre où ils se font : ouvrir le formulaire, coller le
 * message, passer au suivant. La file en bas dit où l'on en est — c'est un
 * repère, pas un second tableau de bord.
 *
 * Le message est préparé ici mais parti d'ailleurs : le client l'ouvre chez le
 * site lui-même, ou dans sa propre messagerie. Envoyer depuis notre domaine
 * ferait arriver la demande sous une signature que le destinataire ne connaît
 * pas, et abîmerait la réputation d'envoi partagée par tous les comptes.
 */

export type ProspectRow = {
  id: string;
  name: string;
  domain: string;
  reason: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  authority: number;
  status: string;
  message: string | null;
};

type ProspectStatus = "found" | "drafted" | "contacted" | "replied" | "published" | "declined";

/** Les états qui sortent un site de la file : le geste a été fait. */
const HANDLED = new Set(["contacted", "replied", "published", "declined"]);

/** Le premier site sur lequel il reste quelque chose à faire. */
function firstOpen(prospects: ProspectRow[]) {
  const found = prospects.findIndex((prospect) => !HANDLED.has(prospect.status));
  return found === -1 ? 0 : found;
}

export function ProspectFlow({ prospects }: { prospects: ProspectRow[] }) {
  const t = useTranslations("dashboard.presence");
  const router = useRouter();
  const [index, setIndex] = useState(() => firstOpen(prospects));

  const find = useAction(findProspectsAction, { onSuccess: () => router.refresh() });

  const total = prospects.length;
  const position = total ? Math.min(index, total - 1) : 0;
  const current = prospects[position];

  const search = (
    <button
      type="button"
      onClick={() => find.execute({})}
      disabled={find.isPending}
      className="cursor-pointer rounded-pill border border-border bg-surface px-4 py-2 text-[13px] font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60"
    >
      {find.isPending ? t("searching") : total ? t("searchMore") : t("search")}
    </button>
  );

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        subtitle={t("flowHint")}
        actions={
          total ? (
            <div className="flex items-center gap-3">
              <span className="text-[13px] tabular-nums text-muted">
                {t("counter", { index: position + 1, total })}
              </span>
              <div className="flex gap-1.5">
                <StepButton
                  label={t("previous")}
                  disabled={position === 0}
                  onClick={() => setIndex(position - 1)}
                  direction="prev"
                />
                <StepButton
                  label={t("next")}
                  disabled={position >= total - 1}
                  onClick={() => setIndex(position + 1)}
                  direction="next"
                />
              </div>
            </div>
          ) : (
            search
          )
        }
      />

      {find.result.serverError ? (
        <p className="text-sm text-danger">{find.result.serverError}</p>
      ) : null}

      {find.isPending && !total ? (
        <Card>
          <SearchLoader kind="prospects" compact title={t("searching")} />
        </Card>
      ) : !current ? (
        <Card className="text-center">
          <p className="py-8 text-sm text-muted">{t("empty")}</p>
        </Card>
      ) : (
        <>
          <Progress done={position} total={total} />
          <ProspectCard
            key={current.id}
            prospect={current}
            onNext={() => setIndex(Math.min(position + 1, total - 1))}
          />
          <Queue prospects={prospects} position={position} onSelect={setIndex} action={search} />
        </>
      )}
    </>
  );
}

/** Où l'on en est : un trait par site traité, puis le reste en un seul bloc. */
function Progress({ done, total }: { done: number; total: number }) {
  const left = Math.max(total - done - 1, 0);

  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: done }, (_, step) => (
        <span key={step} className="h-1 flex-1 rounded-pill bg-obsidian" />
      ))}
      <span className="h-1 flex-[2] rounded-pill bg-pebble" />
      {left ? <span className="h-1 flex-[8] rounded-pill bg-border" /> : null}
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "prev" | "next";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill border border-border bg-surface text-ink transition-colors duration-200 hover:bg-mist disabled:cursor-default disabled:text-ash disabled:hover:bg-surface"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]">
        <path
          d={direction === "prev" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Le site en cours : son identité, puis les trois gestes du contact. */
function ProspectCard({ prospect, onNext }: { prospect: ProspectRow; onNext: () => void }) {
  const t = useTranslations("dashboard.presence");
  const router = useRouter();
  const setStatus = useAction(setProspectStatusAction, { onSuccess: () => router.refresh() });

  const move = (status: ProspectStatus) => {
    setStatus.execute({ id: prospect.id, status });
    onNext();
  };

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[18px] bg-mist"
          >
            <span className="text-base font-extrabold leading-none tabular-nums">
              {prospect.authority}
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-ash">
              {t("authority")}
            </span>
          </span>
          <div className="min-w-0">
            <h2 className="text-[24px] font-bold tracking-[-0.02em]">{prospect.name}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {[prospect.domain, prospect.reason].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNext}
            className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-muted transition-colors duration-200 hover:bg-mist"
          >
            {t("skip")}
          </button>
          <button
            type="button"
            onClick={() => move("declined")}
            className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-muted transition-colors duration-200 hover:bg-mist"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2">
        <OpenPanel prospect={prospect} onSent={() => move("contacted")} />
        <MessagePanel prospect={prospect} />
      </div>
    </section>
  );
}

/** Geste 1 : ouvrir le formulaire du site. Geste 3 : dire que c'est parti. */
function OpenPanel({ prospect, onSent }: { prospect: ProspectRow; onSent: () => void }) {
  const t = useTranslations("dashboard.presence");
  const reasons = (prospect.reason ?? "")
    .split(/\n+|\s·\s/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-[18px] border-b border-border px-6 py-6 sm:px-8 sm:py-7 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5">
        <Step number={1} />
        <h3 className="text-base font-semibold">{t("step1")}</h3>
      </div>

      <ContactCard prospect={prospect} />

      {prospect.contactUrl && prospect.contactEmail ? (
        <p className="text-[13px] leading-relaxed text-graphite">
          {t.rich("altEmail", {
            email: prospect.contactEmail,
            mail: (chunks) => (
              <a
                href={`mailto:${prospect.contactEmail}`}
                className="cursor-pointer underline decoration-pebble underline-offset-[3px] hover:decoration-obsidian"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      ) : null}

      {reasons.length ? (
        <div className="rounded-[20px] bg-mist px-[18px] py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ash">
            {t("whyTitle")}
          </p>
          {reasons.length > 1 ? (
            <ul className="mt-2.5 list-disc pl-[18px] text-[13px] leading-[1.7] text-graphite">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-[13px] leading-[1.7] text-graphite">{reasons[0]}</p>
          )}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-[18px]">
        <Step number={3} muted />
        <button
          type="button"
          onClick={onSent}
          className="cursor-pointer rounded-pill border border-graphite bg-surface px-[18px] py-2.5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-mist"
        >
          {t("sent")}
        </button>
      </div>
    </div>
  );
}

/** La porte d'entrée du site : son formulaire, sinon son adresse. */
function ContactCard({ prospect }: { prospect: ProspectRow }) {
  const t = useTranslations("dashboard.presence");

  const target = prospect.contactUrl
    ? { href: prospect.contactUrl, title: t("contactForm"), hint: contactHint(prospect.contactUrl) }
    : prospect.contactEmail
      ? { href: `mailto:${prospect.contactEmail}`, title: t("writeTo"), hint: prospect.contactEmail }
      : null;

  if (!target) {
    // Le résolveur a échoué sur ce site : plutôt que de laisser le client
    // devant une impasse, on lui tend la recherche qu'il aurait tapée
    // lui-même. C'est le geste manquant, pas un aveu.
    return (
      <div className="flex flex-col items-start gap-3 rounded-3xl bg-mist p-6">
        <p className="text-[13px] leading-relaxed text-graphite">{t("noContact")}</p>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`${prospect.name} contact`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-[13px] font-medium underline decoration-pebble underline-offset-[3px] hover:decoration-obsidian"
        >
          {t("searchContact")}
        </a>
      </div>
    );
  }

  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-3.5 rounded-3xl bg-obsidian p-6 text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[rgba(0,0,0,0.14)_0px_8px_20px_0px] motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-pill bg-white/[0.12]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 4h6v6" />
            <path d="M20 4 11 13" />
            <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
          </g>
        </svg>
      </span>
      <span>
        <span className="block text-[19px] font-bold tracking-[-0.01em]">{target.title}</span>
        <span className="mt-1 block text-[13px] text-ash">
          {target.hint} · {t("newTab")}
        </span>
      </span>
    </a>
  );
}

/** L'adresse du formulaire, sans le protocole : c'est un repère, pas un lien. */
function contactHint(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function Step({ number, muted = false }: { number: number; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 items-center justify-center rounded-pill text-xs font-bold ${
        muted ? "bg-mist text-muted" : "bg-obsidian text-white"
      }`}
    >
      {number}
    </span>
  );
}

/** Geste 2 : le message, relu et modifié avant d'être collé. */
function MessagePanel({ prospect }: { prospect: ProspectRow }) {
  const t = useTranslations("dashboard.presence");
  const router = useRouter();
  const draft = useAction(draftProspectMessageAction, { onSuccess: () => router.refresh() });

  const [subject, setSubject] = useState(() => prospect.message?.split("\n")[0] ?? "");
  const [body, setBody] = useState(() => prospect.message?.split("\n").slice(2).join("\n") ?? "");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers refusé par le navigateur : le texte reste sélectionnable.
    }
  };

  return (
    <div className="flex flex-col gap-3.5 bg-[#fafafa] px-6 py-6 sm:px-8 sm:py-7">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Step number={2} />
          <h3 className="text-base font-semibold">{t("step2")}</h3>
        </div>
        {prospect.message && !draft.isPending ? (
          <button
            type="button"
            onClick={copy}
            className="cursor-pointer rounded-pill bg-obsidian px-[18px] py-2.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-ink"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        ) : null}
      </div>

      {draft.result.serverError ? (
        <p className="text-sm text-danger">{draft.result.serverError}</p>
      ) : null}

      {draft.isPending ? (
        <SearchLoader kind="prospects" compact title={t("drafting")} />
      ) : !prospect.message ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-4 py-10">
          <p className="text-[13px] leading-relaxed text-graphite">{t("noMessageYet")}</p>
          <button
            type="button"
            onClick={() => draft.execute({ id: prospect.id })}
            className="cursor-pointer rounded-pill bg-obsidian px-[18px] py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink"
          >
            {t("draft")}
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{t("subjectLabel")}</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-[11px] text-sm"
            />
          </label>

          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs text-muted">{t("bodyLabel")}</span>
            <textarea
              rows={16}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="w-full resize-y rounded-[20px] border border-border bg-surface px-[18px] py-4 text-[13px] leading-[1.75]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {(["rewrite", "otherTopic", "shorter"] as const).map((angle) => (
              <button
                key={angle}
                type="button"
                onClick={() => draft.execute({ id: prospect.id, angle })}
                className="cursor-pointer rounded-pill border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-graphite transition-colors duration-200 hover:bg-mist"
              >
                {t(`angle.${angle}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** La file : ce qui est fait, ce qui est en cours, ce qui attend. */
function Queue({
  prospects,
  position,
  onSelect,
  action,
}: {
  prospects: ProspectRow[];
  position: number;
  onSelect: (index: number) => void;
  action: React.ReactNode;
}) {
  const t = useTranslations("dashboard.presence");

  return (
    <Card>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{t("queueTitle")}</h2>
        {action}
      </div>
      <div className="flex gap-2.5 overflow-auto pb-1">
        {prospects.map((prospect, index) => {
          const current = index === position;
          const done = HANDLED.has(prospect.status);

          return (
            <button
              key={prospect.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={current ? "step" : undefined}
              className={`w-[190px] shrink-0 cursor-pointer rounded-[20px] p-3.5 text-left transition-opacity duration-200 ${
                current
                  ? "border-[1.5px] border-obsidian bg-surface"
                  : `bg-mist ${done ? "opacity-60 hover:opacity-100" : ""}`
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold tabular-nums">{prospect.authority}</span>
                {current ? (
                  <span className="rounded-pill bg-obsidian px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                    {t("inProgress")}
                  </span>
                ) : prospect.status === "published" || prospect.status === "replied" ? (
                  <svg viewBox="0 0 24 24" aria-hidden className="h-[15px] w-[15px] text-success">
                    <path
                      d="M20 6 9 17l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : prospect.status === "contacted" ? (
                  <span aria-hidden className="h-2 w-2 rounded-pill bg-warning" />
                ) : null}
              </div>
              <p className="mt-2 truncate text-[13px] font-semibold">{prospect.name}</p>
              <p className="mt-0.5 text-[11px] text-muted">{t(`status.${prospect.status}`)}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
