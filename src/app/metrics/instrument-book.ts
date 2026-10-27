// Зачем: пачка содержит события разных инструментов, и свёртка не должна сама выбирать формулу метрики.
// Что делает: держит отдельный аккумулятор на имя и отдаёт снимок в порядке инструментов сессии. Новый экземпляр — это нулевые суммы.

import { MarketUpdate } from '../wasm/market-update';
import { InstrumentAccumulator } from './instrument-accumulator';
import { InstrumentSnapshot } from './metric-reading';

export class InstrumentBook {
  private readonly rows = new Map<string, InstrumentAccumulator>();

  constructor(symbols: readonly string[]) {
    for (const symbol of symbols) {
      this.rows.set(symbol, new InstrumentAccumulator());
    }
  }

  apply(update: MarketUpdate): void {
    const accumulator = this.rows.get(update.instrument);
    if (accumulator === undefined) {
      throw new Error(`Неизвестный инструмент ${update.instrument}.`);
    }
    accumulator.update(update);
  }

  snapshot(): InstrumentSnapshot[] {
    const rows: InstrumentSnapshot[] = [];
    for (const [symbol, accumulator] of this.rows) {
      rows.push(accumulator.read(symbol));
    }
    return rows;
  }
}

export function blankSnapshot(symbols: readonly string[]): InstrumentSnapshot[] {
  return new InstrumentBook(symbols).snapshot();
}
