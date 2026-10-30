// Зачем: у каждого поля одна и та же пара проверок — сначала «целое», потом «диапазон», — и третье звено было бы лишним.
// Что делает: собирает цепочку из двух звеньев на поле и возвращает ошибки всех полей сразу. Apply смотрит на этот список.

import { GeneratorSettings, SettingsDraft } from './generator-settings';

export interface ValidationLink {
  setNext(link: ValidationLink): ValidationLink;
  validate(value: unknown): string | null;
}

export class IntegerLink implements ValidationLink {
  private next: ValidationLink | null = null;

  setNext(link: ValidationLink): ValidationLink {
    this.next = link;
    return link;
  }

  validate(value: unknown): string | null {
    if (value === '') {
      return 'Поле обязательно.';
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return 'Ожидается целое число.';
    }
    return this.next?.validate(value) ?? null;
  }
}

export class RangeLink implements ValidationLink {
  private next: ValidationLink | null = null;

  constructor(
    private readonly min: number,
    private readonly max: number,
  ) {}

  setNext(link: ValidationLink): ValidationLink {
    this.next = link;
    return link;
  }

  validate(value: unknown): string | null {
    if (typeof value !== 'number' || value < this.min || value > this.max) {
      return `Допустимый диапазон ${this.min}–${this.max}.`;
    }
    return this.next?.validate(value) ?? null;
  }
}

export function integerThenRange(min: number, max: number): ValidationLink {
  const integer = new IntegerLink();
  integer.setNext(new RangeLink(min, max));
  return integer;
}

const instrumentCountChain = integerThenRange(1, 50);
const updatesPerBatchChain = integerThenRange(1, 1000);
const batchIntervalChain = integerThenRange(50, 2000);

function fieldError(label: string, chain: ValidationLink, value: unknown): string | null {
  const error = chain.validate(value);
  return error === null ? null : `${label}: ${error}`;
}

export function validateSettings(draft: SettingsDraft): string[] {
  const errors = [
    fieldError('Число инструментов', instrumentCountChain, draft.instrumentCount),
    fieldError('Событий в пачке', updatesPerBatchChain, draft.updatesPerBatch),
    fieldError('Интервал пачки, мс', batchIntervalChain, draft.batchIntervalMs),
  ];
  return errors.filter((error): error is string => error !== null);
}

export type ParsedSettings =
  { ok: true; settings: GeneratorSettings } | { ok: false; errors: string[] };

export function parseSettings(draft: SettingsDraft): ParsedSettings {
  const errors = validateSettings(draft);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    settings: {
      instrumentCount: draft.instrumentCount as number,
      updatesPerBatch: draft.updatesPerBatch as number,
      batchIntervalMs: draft.batchIntervalMs as number,
    },
  };
}
