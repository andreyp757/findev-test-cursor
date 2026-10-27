// Зачем: доменное событие отделено от линейной памяти Wasm, чтобы метрики и страницы не зависели от раскладки ABI.
// Что делает: описывает одно рыночное обновление — инструмент, цену сделки в центах, объём сделки и последний снимок стакана.

export interface MarketUpdate {
  instrument: string;
  priceCents: number;
  tradeQuantity: number;
  bidCents: number;
  askCents: number;
  bidQuantity: number;
  askQuantity: number;
}
