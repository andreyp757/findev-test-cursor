// Зачем: у пяти метрик разные формулы, и общий цикл пачки не должен знать ни одну из них.
// Что делает: задаёт стратегии два шага — учесть один MarketUpdate и прочитать текущее значение для экрана.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';

export interface MetricStrategy {
  update(event: MarketUpdate): void;
  read(): MetricReading;
}
