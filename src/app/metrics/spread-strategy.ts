// Зачем: спред считается только по последнему снимку стакана, накопление сделок его не касается.
// Что делает: хранит последние bidCents и askCents и возвращает их разницу. До первого снимка значение недоступно.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';
import { MetricStrategy } from './metric-strategy';

export class SpreadStrategy implements MetricStrategy {
  private bidCents: number | null = null;
  private askCents: number | null = null;

  update(event: MarketUpdate): void {
    this.bidCents = event.bidCents;
    this.askCents = event.askCents;
  }

  read(): MetricReading {
    if (this.bidCents === null || this.askCents === null) {
      return { kind: 'unavailable' };
    }
    return { kind: 'price', cents: this.askCents - this.bidCents };
  }
}
