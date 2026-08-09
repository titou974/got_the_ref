import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["pro", "agency"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Souscription depuis une analyse précise (visiteur connecté ou non). */
export const analysisCheckoutSchema = z.object({
  analysisId: z.string().min(1),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export type AnalysisCheckoutInput = z.infer<typeof analysisCheckoutSchema>;
