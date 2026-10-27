// Зачем: граница Wasm — это плоские числа в линейной памяти. Домен и метрики не должны видеть ни указатель, ни буфер модуля.
// Что делает: копирует семь i32 на событие в список MarketUpdate. Индекс инструмента — позиция в списке имён сессии. Метрики не считает.

import { MarketUpdate } from './market-update';

export const EVENT_STRIDE = 7;

const INSTRUMENT_INDEX = 0;
const PRICE_CENTS = 1;
const TRADE_QUANTITY = 2;
const BID_CENTS = 3;
const ASK_CENTS = 4;
const BID_QUANTITY = 5;
const ASK_QUANTITY = 6;

export function readMarketUpdates(
  memory: WebAssembly.Memory,
  pointer: number,
  count: number,
  instruments: readonly string[],
): MarketUpdate[] {
  if (count === 0) {
    return [];
  }
  const view = new Int32Array(memory.buffer, pointer, count * EVENT_STRIDE);
  const updates: MarketUpdate[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = index * EVENT_STRIDE;
    const instrumentIndex = view[offset + INSTRUMENT_INDEX];
    const instrument = instruments[instrumentIndex];
    if (instrument === undefined) {
      throw new Error('Адаптер получил индекс инструмента вне списка сессии.');
    }
    updates.push({
      instrument,
      priceCents: view[offset + PRICE_CENTS],
      tradeQuantity: view[offset + TRADE_QUANTITY],
      bidCents: view[offset + BID_CENTS],
      askCents: view[offset + ASK_CENTS],
      bidQuantity: view[offset + BID_QUANTITY],
      askQuantity: view[offset + ASK_QUANTITY],
    });
  }
  return updates;
}
