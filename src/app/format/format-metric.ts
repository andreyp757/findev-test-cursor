// Зачем: внутри приложения цены — целые центы, а на экране нужна валюта. Округление нельзя делать в стратегиях.
// Что делает: переводит показание метрики в строку. Недоступное значение показывает «н/д», а не пустоту и не NaN.

import { MetricReading } from '../metrics/metric-reading';

export function formatCents(cents: number): string {
  // Округление только здесь, на показе.
  const negative = cents < 0;
  const rounded = Math.round(Math.abs(cents));
  const dollars = Math.floor(rounded / 100);
  const remainder = rounded % 100;
  const text = `$${dollars}.${remainder.toString().padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

export function formatMetric(reading: MetricReading): string {
  switch (reading.kind) {
    case 'unavailable':
      return 'н/д';
    case 'price':
      return formatCents(reading.cents);
    case 'quantity':
      return String(reading.value);
    case 'ratio':
      return reading.value.toFixed(2);
    case 'vwap':
      return formatCents(reading.notionalCents / reading.volume);
  }
}
