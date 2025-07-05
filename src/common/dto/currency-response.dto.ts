/**
 * DTOs for consistent currency response formatting
 */
import { CurrencyUtils } from '../utils/currency.utils';

export interface CurrencyAmount {
  amount: number; // Amount in whole currency (dollars/pounds)
  amountCents: number; // Amount in cents (for API compatibility)
  formatted: string; // Formatted display string (e.g., "199 EGP")
}

export class CurrencyResponseDto {
  /**
   * Create a currency response object from cents
   */
  static fromCents(
    amountCents: number,
    currency: string = 'EGP',
  ): CurrencyAmount {
    const amount = CurrencyUtils.fromCents(amountCents);
    return {
      amount,
      amountCents,
      formatted: CurrencyUtils.formatCurrency(amount, currency),
    };
  }

  /**
   * Create a currency response object from whole amount
   */
  static fromAmount(amount: number, currency: string = 'EGP'): CurrencyAmount {
    const amountCents = CurrencyUtils.toCents(amount);
    return {
      amount,
      amountCents,
      formatted: CurrencyUtils.formatCurrency(amount, currency),
    };
  }
}
