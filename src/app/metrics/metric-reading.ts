// Зачем: экранное значение метрики должно быть явным, чтобы «ещё нет данных» не превращалось в NaN в шаблоне.
// Что делает: хранит либо недоступность, либо цену в центах, количество, долю или числитель и знаменатель VWAP.

export type MetricReading =
  | { kind: 'unavailable' }
  | { kind: 'price'; cents: number }
  | { kind: 'quantity'; value: number }
  | { kind: 'ratio'; value: number }
  | { kind: 'vwap'; notionalCents: number; volume: number };

export interface InstrumentSnapshot {
  symbol: string;
  last: MetricReading;
  spread: MetricReading;
  volume: MetricReading;
  vwap: MetricReading;
  imbalance: MetricReading;
}
