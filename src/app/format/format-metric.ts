// Зачем: внутри приложения цены — целые центы, а на экране нужна валюта. Округление нельзя делать в стратегиях.
// Что делает: переводит показание метрики в строку. Недоступное значение показывает «н/д», а не пустоту и не NaN.

import { MetricReading } from '../metrics/metric-reading';

export function formatCents(cents: number | bigint): string {
  // Округление только здесь, на показе.
  if (typeof cents === 'bigint') {
    const negative = cents < 0n;
    const absolute = negative ? -cents : cents;
    const dollars = absolute / 100n;
    const remainder = (absolute % 100n).toString().padStart(2, '0');
    const text = `$${dollars.toString()}.${remainder}`;
    return negative ? `-${text}` : text;
  }
  const negative = cents < 0;
  const rounded = Math.round(Math.abs(cents));
  const dollars = Math.floor(rounded / 100);
  const remainder = rounded % 100;
  const text = `$${dollars}.${remainder.toString().padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

function roundedVwapCents(notionalCents: bigint, volume: bigint): bigint {
  const negative = notionalCents < 0n;
  const notional = negative ? -notionalCents : notionalCents;
  const size = volume < 0n ? -volume : volume;
  const rounded = (notional + size / 2n) / size;
  return negative ? -rounded : rounded;
}

export function formatMetric(reading: MetricReading): string {
  switch (reading.kind) {
    case 'unavailable':
      return 'н/д';
    case 'price':
      return formatCents(reading.cents);
    case 'quantity':
      return reading.value.toString();
    case 'ratio':
      return reading.value.toFixed(2);
    case 'vwap':
      if (reading.volume === 0n) {
        return 'н/д';
      }
      return formatCents(roundedVwapCents(reading.notionalCents, reading.volume));
  }
}
