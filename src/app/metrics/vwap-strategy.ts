// Зачем: VWAP считается по всем сделкам запуска, окно по времени запрещено, а история событий не хранится.
// Что делает: держит сумму priceCents × tradeQuantity и сумму tradeQuantity. При нулевом знаменателе значение недоступно.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';
import { MetricStrategy } from './metric-strategy';

export class VwapStrategy implements MetricStrategy {
  private notionalCents = 0;
  private volume = 0;

  update(event: MarketUpdate): void {
    this.notionalCents += event.priceCents * event.tradeQuantity;
    this.volume += event.tradeQuantity;
  }

  read(): MetricReading {
    // Нулевой знаменатель — значение недоступно, не NaN.
    if (this.volume === 0) {
      return { kind: 'unavailable' };
    }
    return { kind: 'vwap', notionalCents: this.notionalCents, volume: this.volume };
  }
}
