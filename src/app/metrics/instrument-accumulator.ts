// Зачем: у каждого инструмента свои суммы. Общий аккумулятор смешал бы две акции с одинаковыми сделками.
// Что делает: на одно событие вызывает все пять стратегий и собирает их показания в строку снимка.

import { MarketUpdate } from '../wasm/market-update';
import { ImbalanceStrategy } from './imbalance-strategy';
import { InstrumentSnapshot } from './metric-reading';
import { MetricStrategy } from './metric-strategy';
import { LastPriceStrategy } from './last-price-strategy';
import { SpreadStrategy } from './spread-strategy';
import { VolumeStrategy } from './volume-strategy';
import { VwapStrategy } from './vwap-strategy';

export class InstrumentAccumulator {
  private readonly last = new LastPriceStrategy();
  private readonly spread = new SpreadStrategy();
  private readonly volume = new VolumeStrategy();
  private readonly vwap = new VwapStrategy();
  private readonly imbalance = new ImbalanceStrategy();
  private readonly strategies: readonly MetricStrategy[] = [
    this.last,
    this.spread,
    this.volume,
    this.vwap,
    this.imbalance,
  ];

  update(event: MarketUpdate): void {
    for (const strategy of this.strategies) {
      strategy.update(event);
    }
  }

  read(symbol: string): InstrumentSnapshot {
    return {
      symbol,
      last: this.last.read(),
      spread: this.spread.read(),
      volume: this.volume.read(),
      vwap: this.vwap.read(),
      imbalance: this.imbalance.read(),
    };
  }
}
