// Зачем: поле формы отдаёт строку, а цепочка валидации должна сама отвергнуть дробь и мусор, без parseInt, который молча отрежет хвост.
// Что делает: пустую строку и нечисловой текст оставляет как есть, а числовой текст превращает в number, включая нецелые.

export function parseDraftNumber(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return trimmed;
  }
  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) {
    return trimmed;
  }
  return numeric;
}
