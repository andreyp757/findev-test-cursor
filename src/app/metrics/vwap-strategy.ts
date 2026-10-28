// Зачем: VWAP считается по всем сделкам запуска, окно по времени запрещено, а история событий не хранится.
// Что делает: держит сумму priceCents × tradeQuantity и сумму tradeQuantity. При нулевом знаменателе значение недоступно.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';
import { MetricStrategy } from './metric-strategy';

export class VwapStrategy implements MetricStrategy {
  private notionalCents = 0n;
  private volume = 0n;

  update(event: MarketUpdate): void {
    const quantity = BigInt(event.tradeQuantity);
    // Множим уже в bigint: произведение в number теряет младшие центы за пределами 2^53.
    this.notionalCents += BigInt(event.priceCents) * quantity;
    this.volume += quantity;
  }

  read(): MetricReading {
    // Нулевой знаменатель — значение недоступно, не NaN.
    if (this.volume === 0n) {
      return { kind: 'unavailable' };
    }
    return { kind: 'vwap', notionalCents: this.notionalCents, volume: this.volume };
  }
}
