/** Erreur applicative dont le message peut être renvoyé au client en toute sécurité. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthError extends AppError {}
export class BillingError extends AppError {}
