import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["pro", "agency"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Déblocage d'une analyse précise (paiement unique, visiteur connecté ou non). */
export const analysisCheckoutSchema = z.object({
  analysisId: z.string().min(1),
});

export type AnalysisCheckoutInput = z.infer<typeof analysisCheckoutSchema>;
