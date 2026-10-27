// Зачем: Apply с ошибкой не должен доходить до сессии, а форма обязана увидеть сразу все поля.
// Что делает: проверяет порядок «целое, затем диапазон», границы из задания и разбор текста из input.

import { DEFAULT_SETTINGS } from './generator-settings';
import { parseDraftNumber } from './parse-draft';
import { integerThenRange, settingsFromDraft, validateSettings } from './settings-chain';

describe('settings chain', () => {
  it('checks that the value is an integer before it checks the range', () => {
    const chain = integerThenRange(1, 50);
    expect(chain.validate(1.5)).toBe('Ожидается целое число.');
    expect(chain.validate('5')).toBe('Ожидается целое число.');
    expect(chain.validate(0)).toBe('Допустимый диапазон 1–50.');
    expect(chain.validate(51)).toBe('Допустимый диапазон 1–50.');
    expect(chain.validate(5)).toBeNull();
  });

  it('reports every invalid field and accepts the brief defaults and boundaries', () => {
    expect(
      validateSettings({
        instrumentCount: 0,
        updatesPerBatch: 1.5,
        batchIntervalMs: 10,
      }),
    ).toEqual([
      'Число инструментов: Допустимый диапазон 1–50.',
      'Событий в пачке: Ожидается целое число.',
      'Интервал пачки, мс: Допустимый диапазон 50–2000.',
    ]);

    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
    expect(
      validateSettings({ instrumentCount: 1, updatesPerBatch: 1, batchIntervalMs: 50 }),
    ).toEqual([]);
    expect(
      validateSettings({ instrumentCount: 50, updatesPerBatch: 1000, batchIntervalMs: 2000 }),
    ).toEqual([]);
    expect(settingsFromDraft(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(
      settingsFromDraft({ instrumentCount: 0, updatesPerBatch: 100, batchIntervalMs: 500 }),
    ).toBeNull();
  });

  it('keeps a fractional draft numeric so the integer link can reject it', () => {
    expect(parseDraftNumber('5')).toBe(5);
    expect(parseDraftNumber('5.5')).toBe(5.5);
    expect(parseDraftNumber('')).toBe('');
    expect(parseDraftNumber('abc')).toBe('abc');
    expect(parseDraftNumber(' 100 ')).toBe(100);
  });
});
