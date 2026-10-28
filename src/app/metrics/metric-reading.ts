// Зачем: экранное значение метрики должно быть явным, чтобы «ещё нет данных» не превращалось в NaN в шаблоне.
// Что делает: хранит либо недоступность, либо цену в центах, количество, долю или числитель и знаменатель VWAP. Суммы — bigint, чтобы длинный прогон не терял центы.

export type MetricReading =
  | { kind: 'unavailable' }
  | { kind: 'price'; cents: number }
  | { kind: 'quantity'; value: bigint }
  | { kind: 'ratio'; value: number }
  | { kind: 'vwap'; notionalCents: bigint; volume: bigint };

export interface InstrumentSnapshot {
  symbol: string;
  last: MetricReading;
  spread: MetricReading;
  volume: MetricReading;
  vwap: MetricReading;
  imbalance: MetricReading;
}
