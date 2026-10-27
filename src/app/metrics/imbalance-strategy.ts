// Зачем: дисбаланс стакана берётся из последнего снимка и не имеет отношения к накопленному объёму.
// Что делает: хранит последние bidQuantity и askQuantity и считает (bid − ask) / (bid + ask). Диапазон от −1 до +1.

import { MarketUpdate } from '../wasm/market-update';
import { MetricReading } from './metric-reading';
import { MetricStrategy } from './metric-strategy';

export class ImbalanceStrategy implements MetricStrategy {
  private seen = false;
  private bidQuantity = 0;
  private askQuantity = 0;

  update(event: MarketUpdate): void {
    this.seen = true;
    this.bidQuantity = event.bidQuantity;
    this.askQuantity = event.askQuantity;
  }

  read(): MetricReading {
    if (!this.seen) {
      return { kind: 'unavailable' };
    }
    const denominator = this.bidQuantity + this.askQuantity;
    // Нулевой знаменатель — значение недоступно, не NaN.
    if (denominator === 0) {
      return { kind: 'unavailable' };
    }
    return {
      kind: 'ratio',
      value: (this.bidQuantity - this.askQuantity) / denominator,
    };
  }
}
