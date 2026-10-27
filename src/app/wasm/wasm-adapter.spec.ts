// Зачем: адаптер — контракт линейной памяти. Если сдвинуть поле, метрики молча посчитают чужие числа.
// Что делает: кладёт плоские i32 в WebAssembly.Memory и проверяет, что наружу выходит MarketUpdate, а буфер больше не нужен.

import { EVENT_STRIDE, readMarketUpdates } from './wasm-adapter';

describe('readMarketUpdates', () => {
  it('copies flat i32 fields into domain updates and ignores later memory writes', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const view = new Int32Array(memory.buffer);
    const rows = [
      [0, 10_000, 10, 9_900, 10_000, 10, 10],
      [1, 10_200, 30, 10_196, 10_200, 600, 400],
    ];
    rows.forEach((fields, index) => {
      fields.forEach((value, field) => {
        view[index * EVENT_STRIDE + field] = value;
      });
    });

    const updates = readMarketUpdates(memory, 0, 2, ['ALFA', 'BETA']);
    view[1] = 5;

    expect(updates).toEqual([
      {
        instrument: 'ALFA',
        priceCents: 10_000,
        tradeQuantity: 10,
        bidCents: 9_900,
        askCents: 10_000,
        bidQuantity: 10,
        askQuantity: 10,
      },
      {
        instrument: 'BETA',
        priceCents: 10_200,
        tradeQuantity: 30,
        bidCents: 10_196,
        askCents: 10_200,
        bidQuantity: 600,
        askQuantity: 400,
      },
    ]);
  });

  it('returns an empty list for an empty batch and rejects an unknown index', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    expect(readMarketUpdates(memory, 0, 0, ['ALFA'])).toEqual([]);

    new Int32Array(memory.buffer)[0] = 3;
    expect(() => readMarketUpdates(memory, 0, 1, ['ALFA'])).toThrow(/индекс инструмента/);
  });
});
