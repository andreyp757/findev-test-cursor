// Зачем: торговый объём — сумма с начала запуска, и в неё нельзя случайно добавить количества стакана.
// Что делает: копит только tradeQuantity. До сделок сумма равна нулю и остаётся доступным значением.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';
import { MetricStrategy } from './metric-strategy';

export class VolumeStrategy implements MetricStrategy {
  private total = 0n;

  update(event: MarketUpdate): void {
    // В объём входит только tradeQuantity, не количества стакана.
    this.total += BigInt(event.tradeQuantity);
  }

  read(): MetricReading {
    return { kind: 'quantity', value: this.total };
  }
}
