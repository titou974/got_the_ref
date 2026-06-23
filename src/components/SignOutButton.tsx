"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { signOutAction } from "@/features/auth/actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  const t = useTranslations("signOut");
  const { execute, isPending } = useAction(signOutAction);

  return (
    <button
      type="button"
      onClick={() => execute()}
      disabled={isPending}
      className={`cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text disabled:opacity-60 ${className}`}
    >
      {t("label")}
    </button>
  );
}
