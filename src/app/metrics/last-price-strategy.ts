// Зачем: последняя цена сделки — отдельная формула, её нельзя смешивать со спредом или со средним.
// Что делает: запоминает priceCents последнего события. До первой сделки значение недоступно.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';
import { MetricStrategy } from './metric-strategy';

export class LastPriceStrategy implements MetricStrategy {
  private cents: number | null = null;

  update(event: MarketUpdate): void {
    this.cents = event.priceCents;
  }

  read(): MetricReading {
    if (this.cents === null) {
      return { kind: 'unavailable' };
    }
    return { kind: 'price', cents: this.cents };
  }
}
