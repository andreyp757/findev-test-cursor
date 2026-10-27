// Зачем: показ валюты округляет только на экране, и это правило не должно уехать в формулу VWAP.
// Что делает: проверяет центы, недоступное значение, долю и округление дробного VWAP.

import { formatCents, formatMetric } from './format-metric';

describe('formatMetric', () => {
  it('formats integer cents as currency', () => {
    expect(formatCents(10_200)).toBe('$102.00');
    expect(formatCents(10_150)).toBe('$101.50');
    expect(formatCents(4)).toBe('$0.04');
  });

  it('rounds a fractional VWAP only at display time', () => {
    expect(formatMetric({ kind: 'vwap', notionalCents: 100, volume: 3 })).toBe('$0.33');
  });

  it('formats a ratio and an unavailable reading explicitly', () => {
    expect(formatMetric({ kind: 'ratio', value: 0.2 })).toBe('0.20');
    expect(formatMetric({ kind: 'ratio', value: -0.2 })).toBe('-0.20');
    expect(formatMetric({ kind: 'unavailable' })).toBe('н/д');
    expect(formatMetric({ kind: 'quantity', value: 0 })).toBe('0');
  });
});
