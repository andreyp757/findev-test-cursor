// Зачем: поле формы отдаёт строку, а цепочка валидации должна сама отвергнуть дробь, hex и экспоненту.
// Что делает: пропускает дальше только десятичные цифры. Пустую строку и любой другой текст оставляет как есть.

const DECIMAL_DIGITS = /^\d+$/;

export function parseDraftNumber(raw: string): unknown {
  const trimmed = raw.trim();
  if (!DECIMAL_DIGITS.test(trimmed)) {
    return trimmed;
  }
  return Number(trimmed);
}
