/**
 * Currency utilities for consistent currency handling throughout the application
 */

export class CurrencyUtils {
  /**
   * Convert price from whole currency to cents
   * @param amount Amount in whole currency (dollars/pounds)
   * @returns Amount in cents
   */
  static toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Convert price from cents to whole currency
   * @param amountCents Amount in cents
   * @returns Amount in whole currency (dollars/pounds)
   */
  static fromCents(amountCents: number): number {
    return Math.round(amountCents) / 100;
  }

  /**
   * Format currency amount for display
   * @param amount Amount in whole currency
   * @param currency Currency code (default: 'SAR')
   * @returns Formatted currency string
   */
  static formatCurrency(amount: number, currency: string = 'SAR'): string {
    const wholeAmount = Math.round(amount);
    return `${wholeAmount} ${currency}`;
  }

  /**
   * Format currency amount from cents for display
   * @param amountCents Amount in cents
   * @param currency Currency code (default: 'SAR')
   * @returns Formatted currency string
   */
  static formatCurrencyFromCents(
    amountCents: number,
    currency: string = 'SAR',
  ): string {
    const wholeAmount = this.fromCents(amountCents);
    return this.formatCurrency(wholeAmount, currency);
  }

  /**
   * Parse currency string to whole amount
   * @param currencyString String like "199 SAR" or "199"
   * @returns Amount in whole currency
   */
  static parseCurrency(currencyString: string): number {
    const match = currencyString.match(/(\d+(?:\.\d{1,2})?)/);
    return match ? Math.round(parseFloat(match[1])) : 0;
  }
}
