"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";
import { auth } from "@/features/auth/better-auth.config";
import { ROUTES } from "@/constants/routes";
import { signInSchema, signUpSchema } from "./schemas";

export const signUpAction = actionClient
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.signUpEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.password,
          name: parsedInput.name ?? parsedInput.email.split("@")[0],
        },
        headers: await headers(),
      });
    } catch {
      returnValidationErrors(signUpSchema, {
        _errors: ["Impossible de créer le compte. Cet e-mail est peut-être déjà utilisé."],
      });
    }

    redirect(ROUTES.account);
  });

export const signInAction = actionClient
  .inputSchema(signInSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.signInEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.password,
        },
        headers: await headers(),
      });
    } catch {
      returnValidationErrors(signInSchema, {
        _errors: ["E-mail ou mot de passe incorrect."],
      });
    }

    redirect(ROUTES.account);
  });

export const signOutAction = actionClient.action(async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Idempotent : on redirige même sans session active.
  }

  redirect(ROUTES.home);
});
