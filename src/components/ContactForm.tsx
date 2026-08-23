"use client";

import { useState } from "react";

type Labels = {
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  site: string;
  sitePlaceholder: string;
  subject: string;
  subjectPlaceholder: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
};

const field =
  "mt-1.5 w-full rounded-2xl border border-fog bg-snow px-4 py-3 text-sm text-text placeholder:text-ash transition-colors duration-200 focus:border-pebble focus:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/20";

/**
 * Formulaire de contact sans backend : à l'envoi, on ouvre la messagerie du
 * visiteur avec un message déjà rédigé. Aucun service d'e-mail n'est branché
 * sur le projet — plutôt qu'un formulaire qui promet un envoi sans jamais le
 * faire, celui-ci passe la main au client mail, où le visiteur voit partir son
 * message et en garde une trace.
 */
export function ContactForm({ to, labels }: { to: string; labels: Labels }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [site, setSite] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const body = [
      message,
      "",
      `${labels.name} : ${name}`,
      `${labels.email} : ${email}`,
      site ? `${labels.site} : ${site}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n");

    window.location.href = `mailto:${to}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 text-left">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {labels.name}
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            autoComplete="name"
            className={field}
          />
        </label>

        <label className="block text-sm font-medium">
          {labels.email}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.emailPlaceholder}
            autoComplete="email"
            className={field}
          />
        </label>

        <label className="block text-sm font-medium">
          {labels.site}
          <input
            type="url"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder={labels.sitePlaceholder}
            autoComplete="url"
            className={field}
          />
        </label>

        <label className="block text-sm font-medium">
          {labels.subject}
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={labels.subjectPlaceholder}
            className={field}
          />
        </label>
      </div>

      <label className="mt-5 block text-sm font-medium">
        {labels.message}
        <textarea
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={labels.messagePlaceholder}
          className={`${field} resize-y`}
        />
      </label>

      <button
        type="submit"
        className="mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 sm:w-auto"
      >
        {labels.submit}
      </button>
    </form>
  );
}
