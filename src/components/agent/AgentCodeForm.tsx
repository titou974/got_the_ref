"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";

/**
 * La saisie du code, quand le client arrive sur la page sans lien.
 *
 * L'agent affiche l'adresse complète, code compris : c'est le chemin normal, et
 * personne ne devrait avoir à taper huit caractères. Le formulaire existe pour
 * les deux cas où ce chemin casse — un terminal qui ne rend pas les liens
 * cliquables, et un client qui ouvre got_the_ref sur son téléphone pendant que
 * l'agent tourne sur son ordinateur.
 *
 * La saisie se normalise à la frappe : majuscules, tiret posé tout seul. On ne
 * refuse pas « abcd1234 » pour la forme.
 */
export function AgentCodeForm({ invalid = false }: { invalid?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const ready = clean.length === 8;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) router.push(ROUTES.agentLinkWithCode(`${clean.slice(0, 4)}-${clean.slice(4)}`));
      }}
    >
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-steel">
        Connexion d&apos;un agent
      </p>
      <h1 className="mt-3 text-balance text-center text-xl font-bold text-text sm:text-2xl">
        {invalid ? "Ce code n'est plus valable" : "Entrez le code affiché par votre agent"}
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-center text-sm leading-relaxed text-muted">
        {invalid
          ? "Un code vit quinze minutes. Relancez la connexion depuis votre agent pour en obtenir un nouveau."
          : "Votre agent l'affiche dans le terminal, sous la forme ABCD-2345."}
      </p>

      <label className="mt-6 block">
        <span className="sr-only">Code d&apos;appairage</span>
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          placeholder="ABCD-2345"
          className="w-full rounded-[14px] border border-fog bg-mist px-4 py-3.5 text-center font-mono text-lg uppercase tracking-[0.3em] text-text placeholder:tracking-[0.2em] placeholder:text-ash focus:border-graphite focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={!ready}
        className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:bg-pebble disabled:text-steel disabled:shadow-none"
      >
        Continuer
      </button>
    </form>
  );
}
