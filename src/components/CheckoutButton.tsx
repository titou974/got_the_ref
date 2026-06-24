"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createCheckoutAction } from "@/features/billing/actions";
import type { PaidPlanKey } from "@/constants/plans";

export function CheckoutButton({
  plan,
  label,
  highlighted,
}: {
  plan: PaidPlanKey;
  label: string;
  highlighted?: boolean;
}) {
  const t = useTranslations("checkout");
  const { execute, isPending, result } = useAction(createCheckoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const error = result.serverError;

  return (
    <div>
      <button
        type="button"
        onClick={() => execute({ plan })}
        disabled={isPending}
        className={`w-full cursor-pointer rounded-full py-3 font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          highlighted
            ? "bg-cta text-white shadow-[var(--shadow-pill)] hover:bg-cta-hover"
            : "border border-graphite text-graphite hover:bg-mist"
        }`}
      >
        {isPending ? t("redirecting") : label}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
