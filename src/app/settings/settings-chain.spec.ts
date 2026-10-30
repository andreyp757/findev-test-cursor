// Зачем: Apply с ошибкой не должен доходить до сессии, а форма обязана увидеть сразу все поля.
// Что делает: проверяет порядок «целое, затем диапазон», границы из задания и разбор текста из input.

import { DEFAULT_SETTINGS } from './generator-settings';
import { parseDraftNumber } from './parse-draft';
import { integerThenRange, parseSettings, validateSettings } from './settings-chain';

describe('settings chain', () => {
  it('checks that the value is an integer before it checks the range', () => {
    const chain = integerThenRange(1, 50);
    expect(chain.validate('')).toBe('Поле обязательно.');
    expect(chain.validate(1.5)).toBe('Ожидается целое число.');
    expect(chain.validate('5')).toBe('Ожидается целое число.');
    expect(chain.validate('0x10')).toBe('Ожидается целое число.');
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
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual({ ok: true, settings: DEFAULT_SETTINGS });
    expect(
      parseSettings({ instrumentCount: 0, updatesPerBatch: 100, batchIntervalMs: 500 }).ok,
    ).toBe(false);
  });

  it('accepts only decimal digits, not hex, binary or exponent syntax', () => {
    expect(parseDraftNumber('5')).toBe(5);
    expect(parseDraftNumber('5.5')).toBe('5.5');
    expect(parseDraftNumber('')).toBe('');
    expect(parseDraftNumber('abc')).toBe('abc');
    expect(parseDraftNumber(' 100 ')).toBe(100);
    expect(parseDraftNumber('0x10')).toBe('0x10');
    expect(parseDraftNumber('1e3')).toBe('1e3');
    expect(parseDraftNumber('0b11')).toBe('0b11');
    expect(
      validateSettings({
        instrumentCount: parseDraftNumber('0x10'),
        updatesPerBatch: parseDraftNumber('1e3'),
        batchIntervalMs: parseDraftNumber(''),
      }),
    ).toEqual([
      'Число инструментов: Ожидается целое число.',
      'Событий в пачке: Ожидается целое число.',
      'Интервал пачки, мс: Поле обязательно.',
    ]);
  });
});
