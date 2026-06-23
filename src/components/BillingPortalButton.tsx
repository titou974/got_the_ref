"use client";

import { useAction } from "next-safe-action/hooks";
import { openBillingPortalAction } from "@/features/billing/actions";

export function BillingPortalButton({ label }: { label: string }) {
  const { execute, isPending } = useAction(openBillingPortalAction);

  return (
    <button
      type="button"
      onClick={() => execute()}
      disabled={isPending}
      className="cursor-pointer rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-white/5 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
