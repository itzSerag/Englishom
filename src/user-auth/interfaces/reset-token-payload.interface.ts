import { TokenType } from "../enum";

export interface IResetTokenPayload {
  email: string;
  type: TokenType.PASSWORD_RESET;
  iat?: number; // issued at
  exp?: number; // expires at
}
