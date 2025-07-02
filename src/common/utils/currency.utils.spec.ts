/**
 * Test file to verify currency consistency across the application
 * Run this with: npm test currency.utils.spec.ts
 */

import { CurrencyUtils } from '../utils/currency.utils';
import { CurrencyResponseDto } from '../dto/currency-response.dto';

describe('CurrencyUtils', () => {
  describe('toCents', () => {
    it('should convert whole currency to cents correctly', () => {
      expect(CurrencyUtils.toCents(199)).toBe(19900);
      expect(CurrencyUtils.toCents(249.50)).toBe(24950);
      expect(CurrencyUtils.toCents(0)).toBe(0);
      expect(CurrencyUtils.toCents(1)).toBe(100);
    });

    it('should handle floating point precision', () => {
      expect(CurrencyUtils.toCents(199.99)).toBe(19999);
      expect(CurrencyUtils.toCents(199.995)).toBe(20000); // Should round
    });
  });

  describe('fromCents', () => {
    it('should convert cents to whole currency correctly', () => {
      expect(CurrencyUtils.fromCents(19900)).toBe(199);
      expect(CurrencyUtils.fromCents(24950)).toBe(249.5);
      expect(CurrencyUtils.fromCents(0)).toBe(0);
      expect(CurrencyUtils.fromCents(100)).toBe(1);
    });

    it('should handle odd cent amounts', () => {
      expect(CurrencyUtils.fromCents(19999)).toBe(199.99);
      expect(CurrencyUtils.fromCents(20001)).toBe(200.01);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with default EGP', () => {
      expect(CurrencyUtils.formatCurrency(199)).toBe('199 EGP');
      expect(CurrencyUtils.formatCurrency(249.5)).toBe('250 EGP'); // Should round to whole
    });

    it('should format currency with custom currency', () => {
      expect(CurrencyUtils.formatCurrency(199, 'USD')).toBe('199 USD');
      expect(CurrencyUtils.formatCurrency(199, 'GBP')).toBe('199 GBP');
    });
  });

  describe('formatCurrencyFromCents', () => {
    it('should format currency from cents', () => {
      expect(CurrencyUtils.formatCurrencyFromCents(19900)).toBe('199 EGP');
      expect(CurrencyUtils.formatCurrencyFromCents(24950, 'USD')).toBe('250 USD');
    });
  });

  describe('parseCurrency', () => {
    it('should parse currency strings correctly', () => {
      expect(CurrencyUtils.parseCurrency('199 EGP')).toBe(199);
      expect(CurrencyUtils.parseCurrency('249.50')).toBe(250); // Should round
      expect(CurrencyUtils.parseCurrency('$199')).toBe(199);
      expect(CurrencyUtils.parseCurrency('invalid')).toBe(0);
    });
  });
});

describe('CurrencyResponseDto', () => {
  describe('fromCents', () => {
    it('should create proper currency response from cents', () => {
      const response = CurrencyResponseDto.fromCents(19900);
      expect(response.amount).toBe(199);
      expect(response.amountCents).toBe(19900);
      expect(response.formatted).toBe('199 EGP');
    });
  });

  describe('fromAmount', () => {
    it('should create proper currency response from amount', () => {
      const response = CurrencyResponseDto.fromAmount(199);
      expect(response.amount).toBe(199);
      expect(response.amountCents).toBe(19900);
      expect(response.formatted).toBe('199 EGP');
    });
  });
});

describe('Currency Consistency Integration Tests', () => {
  it('should maintain consistency in round-trip conversions', () => {
    const originalAmount = 199;
    const cents = CurrencyUtils.toCents(originalAmount);
    const backToAmount = CurrencyUtils.fromCents(cents);
    expect(backToAmount).toBe(originalAmount);
  });

  it('should handle typical course prices correctly', () => {
    const coursePrices = [199, 249, 299, 349, 399, 449];
    
    coursePrices.forEach(price => {
      const cents = CurrencyUtils.toCents(price);
      const backToPrice = CurrencyUtils.fromCents(cents);
      const formatted = CurrencyUtils.formatCurrency(price);
      
      expect(backToPrice).toBe(price);
      expect(formatted).toBe(`${price} EGP`);
      expect(cents).toBe(price * 100);
    });
  });
});
