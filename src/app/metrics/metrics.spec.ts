// Зачем: формулы из задания легко сломать молча — пример, нулевой знаменатель и смешение инструментов должны падать тестом.
// Что делает: прогоняет стратегии через аккумулятор и книгу, без воркера и без таймера.

import { formatMetric } from '../format/format-metric';
import { MarketUpdate } from '../wasm/market-update';
import { ImbalanceStrategy } from './imbalance-strategy';
import { InstrumentAccumulator } from './instrument-accumulator';
import { InstrumentBook } from './instrument-book';
import { VolumeStrategy } from './volume-strategy';
import { VwapStrategy } from './vwap-strategy';

function trade(
  instrument: string,
  priceCents: number,
  tradeQuantity: number,
  book: Partial<Pick<MarketUpdate, 'bidCents' | 'askCents' | 'bidQuantity' | 'askQuantity'>> = {},
): MarketUpdate {
  return {
    instrument,
    priceCents,
    tradeQuantity,
    bidCents: book.bidCents ?? priceCents,
    askCents: book.askCents ?? priceCents + 1,
    bidQuantity: book.bidQuantity ?? 1,
    askQuantity: book.askQuantity ?? 1,
  };
}

describe('metrics', () => {
  it('matches the brief: two trades, last snapshot spread and imbalance', () => {
    const book = new InstrumentBook(['ALFA']);
    book.apply(
      trade('ALFA', 10_000, 10, {
        bidCents: 9_900,
        askCents: 10_000,
        bidQuantity: 10,
        askQuantity: 10,
      }),
    );
    book.apply(
      trade('ALFA', 10_200, 30, {
        bidCents: 10_196,
        askCents: 10_200,
        bidQuantity: 600,
        askQuantity: 400,
      }),
    );

    const row = book.snapshot()[0];
    expect(row.last).toEqual({ kind: 'price', cents: 10_200 });
    expect(formatMetric(row.last)).toBe('$102.00');
    expect(row.volume).toEqual({ kind: 'quantity', value: 40 });
    expect(formatMetric(row.volume)).toBe('40');
    expect(row.vwap).toEqual({ kind: 'vwap', notionalCents: 406_000, volume: 40 });
    expect(formatMetric(row.vwap)).toBe('$101.50');
    expect(row.spread).toEqual({ kind: 'price', cents: 4 });
    expect(formatMetric(row.spread)).toBe('$0.04');
    expect(row.imbalance).toEqual({ kind: 'ratio', value: 0.2 });
    expect(formatMetric(row.imbalance)).toBe('0.20');
  });

  it('reports unavailable prices and a zero volume before any trade', () => {
    const row = new InstrumentBook(['ALFA']).snapshot()[0];
    expect(row.last).toEqual({ kind: 'unavailable' });
    expect(row.spread).toEqual({ kind: 'unavailable' });
    expect(row.vwap).toEqual({ kind: 'unavailable' });
    expect(row.imbalance).toEqual({ kind: 'unavailable' });
    expect(row.volume).toEqual({ kind: 'quantity', value: 0 });
    expect(formatMetric(row.last)).toBe('н/д');
    expect(formatMetric(new VwapStrategy().read())).toBe('н/д');
  });

  it('returns unavailable imbalance when the book denominator is zero', () => {
    const accumulator = new InstrumentAccumulator();
    accumulator.update(
      trade('ALFA', 10_000, 5, {
        bidCents: 10_000,
        askCents: 10_004,
        bidQuantity: 0,
        askQuantity: 0,
      }),
    );

    const row = accumulator.read('ALFA');
    expect(row.volume).toEqual({ kind: 'quantity', value: 5 });
    expect(row.imbalance).toEqual({ kind: 'unavailable' });
    expect(formatMetric(row.imbalance)).toBe('н/д');
    expect(new ImbalanceStrategy().read()).toEqual({ kind: 'unavailable' });
  });

  it('does not add order-book quantities to volume', () => {
    const volume = new VolumeStrategy();
    volume.update(
      trade('ALFA', 10_000, 5, {
        bidQuantity: 1_000,
        askQuantity: 800,
      }),
    );
    expect(volume.read()).toEqual({ kind: 'quantity', value: 5 });
  });

  it('keeps a separate accumulator per instrument', () => {
    const book = new InstrumentBook(['ALFA', 'BETA']);
    for (const symbol of ['ALFA', 'BETA']) {
      book.apply(trade(symbol, 10_000, 10));
      book.apply(
        trade(symbol, 10_200, 30, {
          bidCents: 10_196,
          askCents: 10_200,
          bidQuantity: 600,
          askQuantity: 400,
        }),
      );
    }

    const [alfa, beta] = book.snapshot();
    expect(alfa.symbol).toBe('ALFA');
    expect(beta.symbol).toBe('BETA');
    expect(alfa.volume).toEqual({ kind: 'quantity', value: 40 });
    expect(beta.volume).toEqual({ kind: 'quantity', value: 40 });
    expect(alfa.vwap).toEqual({ kind: 'vwap', notionalCents: 406_000, volume: 40 });
    expect(beta.vwap).toEqual(alfa.vwap);
  });

  it('rejects an event for an instrument outside the session', () => {
    const book = new InstrumentBook(['ALFA']);
    expect(() => book.apply(trade('BETA', 10_000, 1))).toThrow(/Неизвестный инструмент/);
  });
});
