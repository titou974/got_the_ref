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
      className="cursor-pointer rounded-full border border-graphite px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60"
    >
      {label}
    </button>
  );
}
