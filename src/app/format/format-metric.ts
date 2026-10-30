// Зачем: внутри приложения цены — целые центы, а на экране нужна валюта. Округление нельзя делать в стратегиях.
// Что делает: переводит показание метрики в строку. Недоступное значение показывает «н/д», а не пустоту и не NaN.

import { MetricReading } from '../metrics/metric-reading';

const grouped = new Intl.NumberFormat('en-US');
const ratioFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

export function formatCents(cents: number | bigint): string {
  // Округление только здесь, на показе.
  const asBigInt = typeof cents === 'bigint' ? cents : BigInt(Math.round(cents));
  const negative = asBigInt < 0n;
  const absolute = negative ? -asBigInt : asBigInt;
  const dollars = grouped.format(absolute / 100n);
  const remainder = (absolute % 100n).toString().padStart(2, '0');
  const text = `$${dollars}.${remainder}`;
  return negative ? `-${text}` : text;
}

function formatRatio(value: number): string {
  // Округление половины и знак нуля оставляет Intl: Math.round тянет −0.125 к нулю.
  return ratioFormat.format(value);
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
      return grouped.format(reading.value);
    case 'ratio':
      return formatRatio(reading.value);
    case 'vwap':
      if (reading.volume === 0n) {
        return 'н/д';
      }
      return formatCents(roundedVwapCents(reading.notionalCents, reading.volume));
  }
}
