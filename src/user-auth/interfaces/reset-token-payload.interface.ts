export interface IResetTokenPayload {
  email: string;
  type: 'password_reset';
  iat?: number; // issued at
  exp?: number; // expires at
}
