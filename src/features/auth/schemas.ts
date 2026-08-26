import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);

/**
 * Page à rejoindre une fois identifié. Elle vient du client : elle est reprise
 * telle quelle ici, puis filtrée par `safeNextPath` au moment de rediriger —
 * seul un chemin interne est retenu.
 */
const next = z.string().max(512).optional();

export const signInSchema = z.object({
  email: z.email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
  next,
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Création de compte au retour de Stripe : l'e-mail vient de la session de
 * paiement (il n'est donc pas saisi par l'utilisateur), seul le mot de passe l'est.
 */
export const postCheckoutSignUpSchema = z.object({
  sessionId: z.string().min(1),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  password,
});
export type PostCheckoutSignUpInput = z.infer<typeof postCheckoutSignUpSchema>;

/** Demande d'un lien de réinitialisation : seule l'adresse est saisie. */
export const requestPasswordResetSchema = z.object({
  email: z.email("Adresse e-mail invalide."),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Choix du nouveau mot de passe. Le jeton vient du lien reçu par e-mail : il
 * transite par un champ caché, sa validité étant vérifiée par Better Auth.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Lien de réinitialisation invalide."),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  email: z.email("Adresse e-mail invalide."),
  password,
  next,
});
export type SignUpInput = z.infer<typeof signUpSchema>;
